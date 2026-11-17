package coverletter

import (
	"sync"
	"time"
)

// Limiter ограничивает генерации на пользователя: не больше Limit за Window
// и не больше одной одновременно. Хранится в памяти процесса — для одного
// экземпляра сервера этого достаточно; при нескольких экземплярах лимит
// считается на каждом отдельно.
type Limiter struct {
	Limit  int
	Window time.Duration
	now    func() time.Time

	mu       sync.Mutex
	history  map[int64][]time.Time
	inFlight map[int64]bool
}

func NewLimiter(limit int, window time.Duration) *Limiter {
	return &Limiter{
		Limit: limit, Window: window, now: time.Now,
		history: map[int64][]time.Time{}, inFlight: map[int64]bool{},
	}
}

// Acquire резервирует одну генерацию. Если нельзя — ok=false и через сколько
// повторить. При ok=true обязательно вызвать release; release(true) ещё и
// возвращает попытку в лимит (провайдер отказал, не потратив ни токена).
func (l *Limiter) Acquire(userID int64) (release func(refund bool), ok bool, retryAfter time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	recent := l.history[userID][:0]
	for _, t := range l.history[userID] {
		if now.Sub(t) < l.Window {
			recent = append(recent, t)
		}
	}
	if len(recent) == 0 {
		delete(l.history, userID)
	} else {
		l.history[userID] = recent
	}

	if l.inFlight[userID] {
		return nil, false, 5 * time.Second
	}
	if len(recent) >= l.Limit {
		return nil, false, l.Window - now.Sub(recent[0])
	}
	// Попытка засчитывается сразу: вызов модели стоит денег даже при ошибке.
	l.history[userID] = append(recent, now)
	l.inFlight[userID] = true

	var once sync.Once
	return func(refund bool) {
		once.Do(func() {
			l.mu.Lock()
			defer l.mu.Unlock()
			delete(l.inFlight, userID)
			if refund {
				h := l.history[userID]
				for i := len(h) - 1; i >= 0; i-- {
					if h[i].Equal(now) {
						l.history[userID] = append(h[:i], h[i+1:]...)
						break
					}
				}
			}
		})
	}, true, 0
}

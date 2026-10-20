// Package data — файлы этапов в папке data/: links.json, vacancies.json, errors.json, sites.json.
//
// Все изменения идут через Store под одной блокировкой и сразу пишутся на диск атомарно,
// поэтому сборщик можно прервать в любой момент и продолжить той же командой.
package data

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/jsonfile"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
)

type linksFile struct {
	UpdatedAt time.Time      `json:"updated_at"`
	Links     []sources.Link `json:"links"`
}

type vacanciesFile struct {
	UpdatedAt time.Time         `json:"updated_at"`
	Vacancies []sources.Vacancy `json:"vacancies"`
}

// Error — запись data/errors.json.
type Error struct {
	At     time.Time `json:"at"`
	Stage  string    `json:"stage"`
	Source string    `json:"source"`
	URL    string    `json:"url,omitempty"`
	Error  string    `json:"error"`
}

type errorsFile struct {
	Errors []Error `json:"errors"`
}

const maxErrors = 2000

// Site — состояние сайта между запусками: сколько запусков подряд он нас блокировал.
type Site struct {
	Blocks         int        `json:"blocks"`
	SuspendedUntil *time.Time `json:"suspended_until,omitempty"`
	LastError      string     `json:"last_error,omitempty"`
}

// BlocksToSuspend — после стольких блокировок подряд сайт пропускаем на сутки.
const BlocksToSuspend = 3

type Store struct {
	Dir string
	Now func() time.Time

	mu        sync.Mutex
	links     linksFile
	vacancies vacanciesFile
	errs      errorsFile
	sites     map[string]*Site
	linkIdx   map[string]int
	vacIdx    map[string]int
}

func Open(dir string) (*Store, error) {
	s := &Store{Dir: dir, Now: time.Now, sites: map[string]*Site{}}
	for name, v := range map[string]any{
		"links.json": &s.links, "vacancies.json": &s.vacancies, "errors.json": &s.errs, "sites.json": &s.sites,
	} {
		if err := jsonfile.Read(filepath.Join(dir, name), v); err != nil {
			return nil, err
		}
	}
	if s.sites == nil {
		s.sites = map[string]*Site{}
	}
	s.reindex()
	return s, os.MkdirAll(s.FailedDir(), 0o755)
}

func (s *Store) reindex() {
	s.linkIdx = make(map[string]int, len(s.links.Links))
	for i, l := range s.links.Links {
		s.linkIdx[l.Key()] = i
	}
	s.vacIdx = make(map[string]int, len(s.vacancies.Vacancies))
	for i, v := range s.vacancies.Vacancies {
		s.vacIdx[v.Key()] = i
	}
}

func (s *Store) HTMLDir() string   { return filepath.Join(s.Dir, "html") }
func (s *Store) FailedDir() string { return filepath.Join(s.Dir, "html", "failed") }

// HTMLPath — data/html/<source>-<external_id>.html.
func (s *Store) HTMLPath(l sources.Link) string {
	return filepath.Join(s.HTMLDir(), l.Source+"-"+l.ExternalID+".html")
}

func (s *Store) FailedPath(l sources.Link) string {
	return filepath.Join(s.FailedDir(), l.Source+"-"+l.ExternalID+".html")
}

func (s *Store) saveLinks() error {
	s.links.UpdatedAt = s.Now().UTC()
	return jsonfile.Write(filepath.Join(s.Dir, "links.json"), &s.links)
}

func (s *Store) saveVacancies() error {
	s.vacancies.UpdatedAt = s.Now().UTC()
	return jsonfile.Write(filepath.Join(s.Dir, "vacancies.json"), &s.vacancies)
}

// --- ссылки ---

// KnownLinks — все ссылки источника, которые уже есть в links.json.
func (s *Store) KnownLinks(source string) map[string]bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	known := map[string]bool{}
	for _, l := range s.links.Links {
		if l.Source == source {
			known[l.URL] = true
		}
	}
	return known
}

// AddLinks дописывает новые ссылки, старые не трогает. Возвращает, сколько добавлено.
func (s *Store) AddLinks(links []sources.Link) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	added := 0
	for _, l := range links {
		if _, ok := s.linkIdx[l.Key()]; ok {
			continue
		}
		if l.FoundAt.IsZero() {
			l.FoundAt = s.Now().UTC()
		}
		l.FetchedAt, l.FailedAt = nil, nil
		s.linkIdx[l.Key()] = len(s.links.Links)
		s.links.Links = append(s.links.Links, l)
		added++
	}
	if added == 0 {
		return 0, nil
	}
	return added, s.saveLinks()
}

// PruneLinks удаляет ссылки старше maxAge, которые так и не скачали: вакансию, скорее всего, сняли.
func (s *Store) PruneLinks(maxAge time.Duration) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cutoff := s.Now().Add(-maxAge)
	before := len(s.links.Links)
	s.links.Links = slices.DeleteFunc(s.links.Links, func(l sources.Link) bool {
		return l.FetchedAt == nil && l.FailedAt == nil && l.FoundAt.Before(cutoff)
	})
	n := before - len(s.links.Links)
	if n == 0 {
		return 0, nil
	}
	s.reindex()
	return n, s.saveLinks()
}

// Pending — ссылки источника без fetched_at и без неразобранной страницы.
func (s *Store) Pending(source string) []sources.Link {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []sources.Link
	for _, l := range s.links.Links {
		if l.Source == source && l.FetchedAt == nil && l.FailedAt == nil {
			out = append(out, l)
		}
	}
	return out
}

// Link — ссылка по ключу source:external_id.
func (s *Store) Link(key string) (sources.Link, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	i, ok := s.linkIdx[key]
	if !ok {
		return sources.Link{}, false
	}
	return s.links.Links[i], true
}

// Refetch снимает fetched_at со ссылок источника, скачанных после since: их скачаем заново.
func (s *Store) Refetch(source string, since time.Time) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	n := 0
	for i, l := range s.links.Links {
		if l.Source == source && l.FetchedAt != nil && !l.FetchedAt.Before(since) {
			s.links.Links[i].FetchedAt = nil
			n++
		}
	}
	if n == 0 {
		return 0, nil
	}
	return n, s.saveLinks()
}

func (s *Store) updateLink(key string, f func(*sources.Link)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	i, ok := s.linkIdx[key]
	if !ok {
		return nil
	}
	f(&s.links.Links[i])
	return s.saveLinks()
}

func (s *Store) MarkFetched(key string) error {
	now := s.Now().UTC()
	return s.updateLink(key, func(l *sources.Link) { l.FetchedAt, l.FailedAt = &now, nil })
}

func (s *Store) MarkFailed(key string) error {
	now := s.Now().UTC()
	return s.updateLink(key, func(l *sources.Link) { l.FailedAt = &now })
}

// RemoveLink удаляет ссылку: вакансию сняли, не успев скачать.
func (s *Store) RemoveLink(key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.linkIdx[key]; !ok {
		return nil
	}
	s.links.Links = slices.DeleteFunc(s.links.Links, func(l sources.Link) bool { return l.Key() == key })
	s.reindex()
	return s.saveLinks()
}

// --- вакансии ---

// Upsert — что стало с вакансией при записи.
type Upsert int

const (
	Created Upsert = iota
	Updated
	Unchanged
)

// PutVacancy записывает разобранную вакансию. Теги и отметки об отправке сохраняются:
// по content_hash этапы 3 и 4 сами поймут, что вакансию нужно разметить и отправить заново.
func (s *Store) PutVacancy(v sources.Vacancy) (Upsert, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	res := Created
	if i, ok := s.vacIdx[v.Key()]; ok {
		old := s.vacancies.Vacancies[i]
		res = Updated
		if old.ContentHash == v.ContentHash {
			res = Unchanged
		}
		v.Tags, v.Labels, v.NeedsReview = old.Tags, old.Labels, old.NeedsReview
		v.TaggedWith, v.TaggedHash = old.TaggedWith, old.TaggedHash
		v.PushedHash, v.PushedTaggedWith = old.PushedHash, old.PushedTaggedWith
		s.vacancies.Vacancies[i] = v
	} else {
		s.vacIdx[v.Key()] = len(s.vacancies.Vacancies)
		s.vacancies.Vacancies = append(s.vacancies.Vacancies, v)
	}
	return res, s.saveVacancies()
}

// Vacancies — копия вакансий, для которых keep вернул true.
func (s *Store) Vacancies(keep func(sources.Vacancy) bool) []sources.Vacancy {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []sources.Vacancy
	for _, v := range s.vacancies.Vacancies {
		if keep == nil || keep(v) {
			out = append(out, v)
		}
	}
	return out
}

// UpdateVacancies меняет вакансии по ключам одной записью на диск.
func (s *Store) UpdateVacancies(keys []string, f func(*sources.Vacancy)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, k := range keys {
		if i, ok := s.vacIdx[k]; ok {
			f(&s.vacancies.Vacancies[i])
		}
	}
	return s.saveVacancies()
}

// --- ошибки ---

// AddError дописывает ошибку в errors.json; хранятся последние maxErrors.
func (s *Store) AddError(stage, source, url string, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.errs.Errors = append(s.errs.Errors, Error{At: s.Now().UTC(), Stage: stage, Source: source, URL: url, Error: err.Error()})
	if n := len(s.errs.Errors); n > maxErrors {
		s.errs.Errors = slices.Clone(s.errs.Errors[n-maxErrors:])
	}
	_ = jsonfile.Write(filepath.Join(s.Dir, "errors.json"), &s.errs)
}

// --- сайты ---

// Suspended — сайт блокировал нас BlocksToSuspend запусков подряд, и сутки ещё не прошли.
func (s *Store) Suspended(source string) (time.Time, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.sites[source]
	if st == nil || st.SuspendedUntil == nil || !s.Now().Before(*st.SuspendedUntil) {
		return time.Time{}, false
	}
	return *st.SuspendedUntil, true
}

// SiteResult запоминает итог запуска для сайта: blocked — была проверка «не робот» или 403.
func (s *Store) SiteResult(source string, blocked bool, reason string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.sites[source]
	if st == nil {
		st = &Site{}
		s.sites[source] = st
	}
	if !blocked {
		*st = Site{}
	} else {
		st.Blocks++
		st.LastError = reason
		if st.Blocks >= BlocksToSuspend {
			until := s.Now().Add(24 * time.Hour).UTC()
			st.SuspendedUntil = &until
			st.Blocks = 0
		}
	}
	return jsonfile.Write(filepath.Join(s.Dir, "sites.json"), s.sites)
}

// CleanFailed удаляет из data/html/failed/ страницы старше maxAge.
func (s *Store) CleanFailed(maxAge time.Duration) (int, error) {
	entries, err := os.ReadDir(s.FailedDir())
	if err != nil {
		return 0, err
	}
	cutoff := s.Now().Add(-maxAge)
	n := 0
	for _, e := range entries {
		info, err := e.Info()
		if err != nil || e.IsDir() || !info.ModTime().Before(cutoff) {
			continue
		}
		if os.Remove(filepath.Join(s.FailedDir(), e.Name())) == nil {
			n++
		}
	}
	return n, nil
}

// FailedLinks — ссылки источника, чьи страницы лежат в data/html/failed/.
func (s *Store) FailedLinks(source string) ([]sources.Link, error) {
	entries, err := os.ReadDir(s.FailedDir())
	if err != nil {
		return nil, err
	}
	var out []sources.Link
	for _, e := range entries {
		name, ok := strings.CutSuffix(e.Name(), ".html")
		if !ok || !strings.HasPrefix(name, source+"-") {
			continue
		}
		id := strings.TrimPrefix(name, source+"-")
		if l, ok := s.Link(source + ":" + id); ok {
			out = append(out, l)
		}
	}
	return out, nil
}

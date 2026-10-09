"""
Скачивает страницы вакансий hh.ru через настоящий браузер и сохраняет их в pages/<номер>.html,
затем заполняет vacancy.json скриптом fill_from_saved_pages.py.

Установка (один раз, в активированном .venv):
    pip install playwright
    playwright install chromium

Запуск (из папки, где лежат vacancy.json и fill_from_saved_pages.py):
    python scrape_hh_pages.py

Браузер откроется в видимом окне. Если hh.ru покажет «Подтвердите, что вы не робот»,
скрипт остановится: введи текст с картинки в окне браузера и нажми Enter в терминале.
Профиль браузера сохраняется в .hh_browser_profile/, поэтому при следующих запусках
проверка обычно не повторяется. Добавь эту папку и pages/ в .gitignore.
"""
import json, os, random, time
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE = os.path.dirname(os.path.abspath(__file__))
FILE = os.path.join(BASE, "vacancy.json")
PAGES = os.path.join(BASE, "pages")
PROFILE = os.path.join(BASE, ".hh_browser_profile")
DESC = '[data-qa="vacancy-description"]'
PAUSE = (4, 8)   # секунды между вакансиями: не нагружаем сайт


def load_vacancies(path):
    data = json.load(open(path, encoding="utf-8-sig"))
    if not isinstance(data, list) or not all(isinstance(v, dict) and "url" in v and "id" in v for v in data):
        raise SystemExit(
            f"{os.path.abspath(path)} в старом формате (\"вариант 1\", \"вариант 2\"...).\n"
            "Замени его исправленным vacancy.json (список с полями id, category, title, url, "
            "requirements, description) и запусти снова.")
    return data


def is_captcha(page):
    return "не робот" in page.title().lower() or page.locator("text=Подтвердите, что вы не робот").count() > 0


def main():
    os.makedirs(PAGES, exist_ok=True)
    vacancies = load_vacancies(FILE)
    todo = []
    for v in vacancies:
        vid = v["url"].rstrip("/").split("/")[-1]
        path = os.path.join(PAGES, f"{vid}.html")
        if os.path.exists(path):
            print(f'{v["id"]}: уже скачана, пропускаю')
        else:
            todo.append((v["id"], v["url"], path))

    with sync_playwright() as p:
        browser = p.chromium.launch_persistent_context(PROFILE, headless=False, locale="ru-RU", channel="msedge")
        page = browser.pages[0] if browser.pages else browser.new_page()

        for i, (vid, url, path) in enumerate(todo):
            page.goto(url, wait_until="domcontentloaded")

            if is_captcha(page):
                input(f"{vid}: hh.ru просит подтвердить, что ты не робот. "
                      "Пройди проверку в окне браузера и нажми Enter здесь... ")
                page.goto(url, wait_until="domcontentloaded")

            try:
                page.wait_for_selector(DESC, timeout=15000)
            except PWTimeout:
                print(f"{vid}: описание не появилось (вакансия в архиве или другая вёрстка) — пропускаю")
                continue

            with open(path, "w", encoding="utf-8") as f:
                f.write(page.content())
            print(f"{vid}: сохранена в {path}")

            if i < len(todo) - 1:
                time.sleep(random.uniform(*PAUSE))

        browser.close()

    print("\nСтраницы скачаны, заполняю vacancy.json...\n")
    import fill_from_saved_pages
    fill_from_saved_pages.main()


if __name__ == "__main__":
    main()

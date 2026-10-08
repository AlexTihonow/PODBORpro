"""
Заполняет requirements и description в vacancy.json из страниц hh.ru, сохранённых браузером.

1. Открой каждую вакансию в браузере и сохрани страницу (Ctrl+S, «Веб-страница, только HTML»)
   в папку pages/ рядом со скриптом. Имя файла — номер вакансии из ссылки: 137568898.html
2. Запусти:  python fill_from_saved_pages.py
"""
import html, json, os, re
from html.parser import HTMLParser

BASE = os.path.dirname(os.path.abspath(__file__))
FILE = os.path.join(BASE, "vacancy.json")
PAGES = os.path.join(BASE, "pages")

REQ_WORDS = ("требован", "ожидаем", "что мы ждём", "что мы ждем", "мы ждём", "мы ждем",
             "нам важно", "навыки", "необходим", "мы ищем", "requirements", "you have")
STOP_WORDS = ("условия", "мы предлагаем", "предлагаем", "обязанност", "задачи", "чем предстоит",
              "будет плюсом", "плюсом", "о компании", "что мы даём", "что мы даем", "бонус")


class Extractor(HTMLParser):
    """Достаёт HTML блока описания (data-qa="vacancy-description") и ключевые навыки."""
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.desc, self.depth, self.skills = [], 0, []
        self.skill_depth = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        qa = a.get("data-qa", "") or ""
        if self.depth:
            self.depth += 1
            self.desc.append(self.get_starttag_text())
        elif qa == "vacancy-description":
            self.depth = 1
        if self.skill_depth:
            self.skill_depth += 1
        elif "skills-element" in qa:
            self.skill_depth = 1
            self.skills.append("")

    def handle_endtag(self, tag):
        if self.skill_depth:
            self.skill_depth -= 1
        if self.depth:
            self.depth -= 1
            if self.depth:
                self.desc.append(f"</{tag}>")

    def handle_data(self, data):
        if self.depth:
            self.desc.append(data)
        if self.skill_depth:
            self.skills[-1] += data

    def handle_entityref(self, name):
        self.handle_data(f"&{name};")

    def handle_charref(self, name):
        self.handle_data(f"&#{name};")


def load_vacancies(path):
    data = json.load(open(path, encoding="utf-8-sig"))
    if not isinstance(data, list) or not all(isinstance(v, dict) and "url" in v and "id" in v for v in data):
        raise SystemExit(
            f"{os.path.abspath(path)} в старом формате (\"вариант 1\", \"вариант 2\"...).\n"
            "Замени его исправленным vacancy.json (список с полями id, category, title, url, "
            "requirements, description) и запусти снова.")
    return data


def to_text(fragment):
    t = re.sub(r"<li[^>]*>", "; ", fragment)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t)
    t = re.sub(r"\s+", " ", t).strip(" ;")
    t = re.sub(r"\s*;\s*", "; ", t)
    return re.sub(r"(;\s*)+", "; ", t).strip(" ;")


def requirements_block(desc_html):
    parts = re.split(r"(<(?:strong|b|h\d|p)[^>]*>.*?</(?:strong|b|h\d|p)>)", desc_html, flags=re.S | re.I)
    collecting, out = False, []
    for part in parts:
        txt = to_text(part)
        is_heading = bool(re.match(r"<(strong|b|h\d)", part, re.I)) or (
            part.lower().startswith("<p") and len(txt) < 60 and txt.endswith(":"))
        low = txt.lower()
        if is_heading and any(w in low for w in REQ_WORDS):
            collecting = True
            continue
        if collecting and is_heading and any(w in low for w in STOP_WORDS):
            break
        if collecting:
            out.append(part)
    return to_text("".join(out))


def main():
    data = load_vacancies(FILE)
    for v in data:
        vid = v["url"].rstrip("/").split("/")[-1]
        path = os.path.join(PAGES, f"{vid}.html")
        if not os.path.exists(path):
            print(f'{v["id"]}: нет файла {path}')
            continue
        ex = Extractor()
        ex.feed(open(path, encoding="utf-8", errors="ignore").read())
        desc_html = "".join(ex.desc)
        if not desc_html.strip():
            print(f'{v["id"]}: описание на странице не найдено — сохрани страницу заново или заполни вручную')
            continue
        skills = [s.strip() for s in ex.skills if s.strip()]
        req = requirements_block(desc_html)
        found = bool(req)
        if skills:
            req = (req + ". " if req else "") + "Ключевые навыки: " + ", ".join(dict.fromkeys(skills))
        v["description"] = v["description"] or to_text(desc_html)
        v["requirements"] = v["requirements"] or req
        flag = "" if found else "  ← блок требований не найден, проверь вручную"
        print(f'{v["id"]}: ок, описание {len(v["description"])} симв., требования {len(v["requirements"])} симв.{flag}')

    with open(FILE, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Готово, файл перезаписан.")


if __name__ == "__main__":
    main()

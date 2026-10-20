import { withBase } from "../router.js";
import { mountPublic } from "../shell.js";
import { icon, logo } from "../ui.js";

export function renderNotFoundPage() {
  mountPublic(`<div class="not-found">
    <div class="not-found__brand">${logo()}</div>
    <div class="not-found__card">
      <span class="not-found__code">404</span>
      <h1 class="not-found__title" data-testid="not-found-title">Не найдено</h1>
      <p class="not-found__text">Такой страницы нет. Возможно, ссылка устарела или в адресе опечатка.</p>
      <div class="not-found__actions">
        <a class="btn btn--primary btn--md" href="${withBase("/feed")}" data-link data-to="/feed">${icon("arrow")} К ленте</a>
        <a class="btn btn--secondary btn--md" href="${withBase("/login")}" data-link data-to="/login">На страницу входа</a>
      </div>
    </div>
  </div>`);
}

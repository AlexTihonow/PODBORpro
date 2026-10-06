// Сгенерировано scripts/extract-stubs.mjs — не править вручную.
export interface StubRoute {
  operationId: string;
  method: string;
  path: string;
}

export const stubRoutes: StubRoute[] = [
  {
    "operationId": "getHealth",
    "method": "GET",
    "path": "/health"
  },
  {
    "operationId": "register",
    "method": "POST",
    "path": "/auth/register"
  },
  {
    "operationId": "login",
    "method": "POST",
    "path": "/auth/login"
  },
  {
    "operationId": "getMe",
    "method": "GET",
    "path": "/me"
  },
  {
    "operationId": "patchMe",
    "method": "PATCH",
    "path": "/me"
  },
  {
    "operationId": "searchSkills",
    "method": "GET",
    "path": "/skills"
  },
  {
    "operationId": "uploadResume",
    "method": "POST",
    "path": "/portfolio/resume"
  },
  {
    "operationId": "connectGithub",
    "method": "POST",
    "path": "/portfolio/github"
  },
  {
    "operationId": "listPortfolioItems",
    "method": "GET",
    "path": "/portfolio/items"
  },
  {
    "operationId": "createPortfolioItem",
    "method": "POST",
    "path": "/portfolio/items"
  },
  {
    "operationId": "patchPortfolioItem",
    "method": "PATCH",
    "path": "/portfolio/items/{id}"
  },
  {
    "operationId": "deletePortfolioItem",
    "method": "DELETE",
    "path": "/portfolio/items/{id}"
  },
  {
    "operationId": "listVacancies",
    "method": "GET",
    "path": "/vacancies"
  },
  {
    "operationId": "getVacancy",
    "method": "GET",
    "path": "/vacancies/{id}"
  },
  {
    "operationId": "getFeed",
    "method": "GET",
    "path": "/feed"
  },
  {
    "operationId": "createLetter",
    "method": "POST",
    "path": "/vacancies/{id}/letters"
  },
  {
    "operationId": "getLetter",
    "method": "GET",
    "path": "/letters/{id}"
  },
  {
    "operationId": "patchLetter",
    "method": "PATCH",
    "path": "/letters/{id}"
  },
  {
    "operationId": "listLetterVersions",
    "method": "GET",
    "path": "/letters/{id}/versions"
  },
  {
    "operationId": "listApplications",
    "method": "GET",
    "path": "/applications"
  },
  {
    "operationId": "createApplication",
    "method": "POST",
    "path": "/applications"
  },
  {
    "operationId": "patchApplication",
    "method": "PATCH",
    "path": "/applications/{id}"
  },
  {
    "operationId": "listCollectionRuns",
    "method": "GET",
    "path": "/admin/collection-runs"
  },
  {
    "operationId": "getDataQuality",
    "method": "GET",
    "path": "/admin/data-quality"
  }
];

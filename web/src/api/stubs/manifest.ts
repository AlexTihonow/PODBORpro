// Сгенерировано scripts/extract-stubs.mjs — не править вручную.
import getHealth_200 from "./getHealth.200.json";
import getHealth_503 from "./getHealth.503.json";
import register_201 from "./register.201.json";
import register_409 from "./register.409.json";
import login_200 from "./login.200.json";
import login_401 from "./login.401.json";
import getMe_200 from "./getMe.200.json";
import patchMe_200 from "./patchMe.200.json";
import searchSkills_200 from "./searchSkills.200.json";
import uploadResume_202 from "./uploadResume.202.json";
import uploadResume_400 from "./uploadResume.400.json";
import uploadResume_413 from "./uploadResume.413.json";
import connectGithub_200 from "./connectGithub.200.json";
import connectGithub_404 from "./connectGithub.404.json";
import listPortfolioItems_200 from "./listPortfolioItems.200.json";
import createPortfolioItem_201 from "./createPortfolioItem.201.json";
import patchPortfolioItem_200 from "./patchPortfolioItem.200.json";
import listVacancies_200 from "./listVacancies.200.json";
import getVacancy_200 from "./getVacancy.200.json";
import getFeed_200 from "./getFeed.200.json";
import createLetter_201 from "./createLetter.201.json";
import createLetter_503 from "./createLetter.503.json";
import getLetter_200 from "./getLetter.200.json";
import patchLetter_200 from "./patchLetter.200.json";
import patchLetter_409 from "./patchLetter.409.json";
import listLetterVersions_200 from "./listLetterVersions.200.json";
import listApplications_200 from "./listApplications.200.json";
import createApplication_201 from "./createApplication.201.json";
import createApplication_409 from "./createApplication.409.json";
import patchApplication_200 from "./patchApplication.200.json";
import listCollectionRuns_200 from "./listCollectionRuns.200.json";
import getDataQuality_200 from "./getDataQuality.200.json";

export const stubMap = {
  getHealth: { 200: getHealth_200, 503: getHealth_503 },
  register: { 201: register_201, 409: register_409 },
  login: { 200: login_200, 401: login_401 },
  getMe: { 200: getMe_200 },
  patchMe: { 200: patchMe_200 },
  searchSkills: { 200: searchSkills_200 },
  uploadResume: { 202: uploadResume_202, 400: uploadResume_400, 413: uploadResume_413 },
  connectGithub: { 200: connectGithub_200, 404: connectGithub_404 },
  listPortfolioItems: { 200: listPortfolioItems_200 },
  createPortfolioItem: { 201: createPortfolioItem_201 },
  patchPortfolioItem: { 200: patchPortfolioItem_200 },
  listVacancies: { 200: listVacancies_200 },
  getVacancy: { 200: getVacancy_200 },
  getFeed: { 200: getFeed_200 },
  createLetter: { 201: createLetter_201, 503: createLetter_503 },
  getLetter: { 200: getLetter_200 },
  patchLetter: { 200: patchLetter_200, 409: patchLetter_409 },
  listLetterVersions: { 200: listLetterVersions_200 },
  listApplications: { 200: listApplications_200 },
  createApplication: { 201: createApplication_201, 409: createApplication_409 },
  patchApplication: { 200: patchApplication_200 },
  listCollectionRuns: { 200: listCollectionRuns_200 },
  getDataQuality: { 200: getDataQuality_200 },
} as const;

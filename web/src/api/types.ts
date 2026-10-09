import type { components } from "./schema";

/**
 * Короткие имена для удобства. Единственный источник истины — сгенерированный
 * `src/api/schema.d.ts` (openapi-typescript). Ручных типов здесь больше нет:
 * если старший поменяет поле в openapi.yaml, после `pnpm generate:types`
 * TypeScript покажет все места, которые нужно поправить.
 */

export type ApiErrorBody = components["schemas"]["Error"];
export type Health = components["schemas"]["Health"];

export type Grade = components["schemas"]["Grade"];
export type WorkFormat = components["schemas"]["WorkFormat"];
export type Tone = components["schemas"]["Tone"];
export type ResumeStatus = components["schemas"]["ResumeStatus"];
export type Skill = components["schemas"]["Skill"];

export type User = components["schemas"]["User"];
export type TokenResponse = components["schemas"]["TokenResponse"];
export type RegisterRequest = components["schemas"]["RegisterRequest"];
export type LoginRequest = components["schemas"]["LoginRequest"];

export type Profile = components["schemas"]["Profile"];
export type Me = components["schemas"]["Me"];
export type PatchMeRequest = components["schemas"]["PatchMeRequest"];

export type ResumeUploadResponse = components["schemas"]["ResumeUploadResponse"];
export type GithubConnectRequest = components["schemas"]["GithubConnectRequest"];
export type PortfolioItem = components["schemas"]["PortfolioItem"];
export type PortfolioItemList = components["schemas"]["PortfolioItemList"];
export type PortfolioItemCreate = components["schemas"]["PortfolioItemCreate"];
export type PortfolioItemPatch = components["schemas"]["PortfolioItemPatch"];

export type Vacancy = components["schemas"]["Vacancy"];
export type VacancyDetails = components["schemas"]["VacancyDetails"];
export type VacancyCopy = components["schemas"]["VacancyCopy"];
export type VacancyPage = components["schemas"]["VacancyPage"];

export type ScoreParts = components["schemas"]["ScoreParts"];
export type ScoreExplanation = components["schemas"]["ScoreExplanation"];
export type FeedItem = components["schemas"]["FeedItem"];
export type FeedResponse = components["schemas"]["FeedResponse"];

export type TextFragment = components["schemas"]["TextFragment"];
export type LetterCreate = components["schemas"]["LetterCreate"];
export type Letter = components["schemas"]["Letter"];
export type LetterPatch = components["schemas"]["LetterPatch"];
export type LetterVersion = components["schemas"]["LetterVersion"];
export type LetterVersionList = components["schemas"]["LetterVersionList"];

export type ApplicationStatus = components["schemas"]["ApplicationStatus"];
export type Application = components["schemas"]["Application"];
export type ApplicationPage = components["schemas"]["ApplicationPage"];
export type ApplicationCreate = components["schemas"]["ApplicationCreate"];
export type ApplicationPatch = components["schemas"]["ApplicationPatch"];

export type CollectionRun = components["schemas"]["CollectionRun"];
export type CollectionRunPage = components["schemas"]["CollectionRunPage"];
export type DataQuality = components["schemas"]["DataQuality"];
export type SourceQuality = components["schemas"]["SourceQuality"];

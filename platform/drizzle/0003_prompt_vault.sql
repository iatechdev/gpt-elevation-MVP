-- Migration: 0003_prompt_vault
-- HU-028: Prompt Vault — stores all AI prompts encrypted at rest
-- Run: pnpm db:push  (or apply manually in your MySQL client)

CREATE TABLE `prompt_versions` (
  `id`                INT          NOT NULL AUTO_INCREMENT,
  `promptKey`         VARCHAR(50)  NOT NULL,
  `contentEncrypted`  TEXT         NOT NULL,
  `version`           INT          NOT NULL DEFAULT 1,
  `status`            ENUM('draft','pending_review','active','archived') NOT NULL DEFAULT 'draft',
  `changeNote`        VARCHAR(500),
  `createdBy`         INT          NOT NULL,
  `approvedBy`        INT,
  `createdAt`         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approvedAt`        TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- Index to quickly find the active prompt for a given key
CREATE INDEX `idx_prompt_versions_key_status`
  ON `prompt_versions` (`promptKey`, `status`);

-- Index to list prompts pending review
CREATE INDEX `idx_prompt_versions_status`
  ON `prompt_versions` (`status`);

// This is a coverage policy, not product authentication or a permission contract.
export const LAYERS = Object.freeze(['unit_doubles', 'http_doubles', 'db_real', 'browser_fixtures', 'staging_api', 'staging_browser', 'human_review', 'followup'])
export const BLOCKER_IDS = Object.freeze(['environment', 'isolated-data', 'migration', 'integration', 'canonical-context', 'sharing', 'retention', 'ai-approval', 'catalogue', 'specialist-tone', 'specialist-safety', 'specialist-corpus', 'qa-cut-1', 'qa-cut-2', 'qa-cut-3', 'qa-cut-4', 'screen-review', 'support'])
const definitions = [
  {
    "id": "E45-01",
    "layers": [
      "staging_api",
      "human_review"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-02",
    "layers": [
      "staging_browser"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-03",
    "layers": [
      "staging_api",
      "staging_browser"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-04",
    "layers": [
      "db_real",
      "staging_browser"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-05",
    "layers": [
      "staging_browser",
      "human_review"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-06",
    "layers": [
      "staging_api",
      "staging_browser"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-07",
    "layers": [
      "staging_api",
      "staging_browser"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-08",
    "layers": [
      "staging_api",
      "staging_browser"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-09",
    "layers": [
      "staging_api",
      "staging_browser",
      "human_review"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-10",
    "layers": [
      "staging_browser",
      "human_review"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-11",
    "layers": [
      "staging_api",
      "staging_browser"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-12",
    "layers": [
      "staging_api",
      "staging_browser"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-13",
    "layers": [
      "staging_api",
      "staging_browser",
      "human_review"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-14",
    "layers": [
      "staging_api",
      "staging_browser"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-15",
    "layers": [
      "staging_api",
      "staging_browser"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-16",
    "layers": [
      "db_real",
      "staging_api",
      "staging_browser"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-17",
    "layers": [
      "db_real",
      "staging_api",
      "staging_browser"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-18",
    "layers": [
      "db_real",
      "staging_api",
      "staging_browser"
    ],
    "edges": [
      "owner-a",
      "foreign-user-b",
      "unassigned-facilitator",
      "assigned-facilitator",
      "admin-unassigned",
      "superadmin-unassigned",
      "therapist",
      "board",
      "revoked-session"
    ],
    "destructive": false
  },
  {
    "id": "E45-19",
    "layers": [
      "db_real",
      "staging_api",
      "staging_browser"
    ],
    "edges": [
      "before",
      "during",
      "before-commit",
      "after-publication"
    ],
    "destructive": false
  },
  {
    "id": "E45-20",
    "layers": [
      "db_real",
      "staging_api",
      "staging_browser"
    ],
    "edges": [
      "double-send",
      "lost-ack",
      "restart"
    ],
    "destructive": false
  },
  {
    "id": "E45-21",
    "layers": [
      "staging_api",
      "staging_browser"
    ],
    "edges": [
      "budget",
      "timeout",
      "provider-error"
    ],
    "destructive": false
  },
  {
    "id": "E45-22",
    "layers": [
      "db_real",
      "staging_api",
      "human_review"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-23",
    "layers": [
      "db_real",
      "staging_browser"
    ],
    "edges": [
      "journey"
    ],
    "destructive": true
  },
  {
    "id": "E45-24",
    "layers": [
      "staging_browser",
      "human_review"
    ],
    "edges": [
      "mobile-320",
      "mobile-375",
      "tablet-768",
      "desktop-1440",
      "keyboard",
      "zoom-200",
      "dark",
      "reduced-motion"
    ],
    "destructive": false
  },
  {
    "id": "E45-25",
    "layers": [
      "staging_api",
      "staging_browser"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-26",
    "layers": [
      "staging_api",
      "staging_browser",
      "human_review"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-27",
    "layers": [
      "human_review"
    ],
    "edges": [
      "journey"
    ],
    "destructive": false
  },
  {
    "id": "E45-28",
    "layers": [
      "followup"
    ],
    "edges": [
      "day-7",
      "day-30"
    ],
    "destructive": false
  }
]
export const POLICY = Object.freeze(definitions.map(item => Object.freeze({
  ...item, layers: Object.freeze(item.layers),
  variants: Object.freeze(['es', 'en'].flatMap(locale => item.edges.map(edge => ({ id: locale + '-' + edge, locale, edge })))),
})))
export const COMMANDS = Object.freeze(['unit_test', 'http_test', 'manual_steps', 'browser_journey', 'api_check', 'db_check', 'human_review', 'followup_observation'])
export const LAYER_COMMANDS = Object.freeze({
  unit_doubles: ['unit_test'], http_doubles: ['http_test', 'api_check'],
  db_real: ['db_check'], browser_fixtures: ['browser_journey'],
  staging_api: ['api_check', 'manual_steps'], staging_browser: ['browser_journey', 'manual_steps'],
  human_review: ['human_review'], followup: ['followup_observation'],
})
export const ENVIRONMENTS = Object.freeze(['local', 'ci', 'staging', 'followup'])
export const STATUSES = Object.freeze(['not_run', 'blocked', 'passed', 'failed'])
export const BOUNDARIES = Object.freeze(['api', 'database', 'crypto', 'provider', 'identity', 'permissions', 'storage', 'clock'])
export const MEDIA = Object.freeze(['application/json', 'text/plain', 'text/markdown', 'image/png'])
export const REASONS = Object.freeze(['not_executed', 'dependency_missing', 'contract_pending', 'environment_unverified', 'authorization_pending', 'check_passed', 'assertion_failed', 'provider_pending', 'human_review_pending', 'followup_not_due'])

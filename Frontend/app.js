let BACKEND_URL = null;
const BACKEND_PORTS = [3000, 3001, 3002];
const FRONTEND_BUILD = '20260823b';
const ALLOWED_CARD_YEARS = ['2025', '2026', '2025-2026'];
const SKU_COMMITTED_COUNTER_KEY = 'cardAutoCommittedSkuCounter';
const ACTIVE_SPORT_KEY = 'cardAutoActiveSport';
const ACTIVE_PAGE_KEY = 'cardAutoActivePage';
const AUTH_TOKEN_KEY = 'cardPilotAuthToken';
const AUTH_SESSION_TOKEN_KEY = 'cardPilotAuthTokenSession';
const AUTH_REMEMBER_KEY = 'cardPilotRememberMe';
const IMPORT_IN_PROGRESS_KEY = 'cardAutoImportInProgress';
const SCAN_DRAFT_KEY = 'cardAutoScanDraft';
const SCAN_DRAFT_DB_NAME = 'cardAutoScanDraftDB';
const SCAN_DRAFT_STORE = 'drafts';
const SCAN_DRAFT_RECORD_ID = 'current';
const IMPORT_AI_CONCURRENCY = 1;
const OCR_WINDOW_MS = 60_000;
const OCR_MAX_PER_WINDOW = 30;
const OCR_CLIENT_HEADROOM = 8;
const OCR_MIN_INTERVAL_MS = 2500;
const DEFAULT_CONNECTION_PROVIDERS = [
  {
    key: 'ebay',
    label: 'eBay',
    category: 'listing',
    authTypes: ['oauth', 'api-key', 'manual'],
    supportsDirectAuth: true,
    notes: 'Best target for listing submission and sold-listing research.'
  },
  {
    key: '130point',
    label: '130point.com',
    category: 'research',
    authTypes: ['manual', 'cookie-session'],
    supportsDirectAuth: false,
    notes: 'Useful for sold-price research. Direct sign-in usually needs a custom workflow.'
  },
  {
    key: 'collx',
    label: 'CollX',
    category: 'research',
    authTypes: ['oauth', 'manual'],
    supportsDirectAuth: false,
    notes: 'Useful for collection and pricing research.'
  },
  {
    key: 'ludex',
    label: 'Ludex',
    category: 'research',
    authTypes: ['oauth', 'manual'],
    supportsDirectAuth: false,
    notes: 'Useful for pricing and collection workflows.'
  },
  {
    key: 'other',
    label: 'Other',
    category: 'custom',
    authTypes: ['oauth', 'api-key', 'manual', 'cookie-session'],
    supportsDirectAuth: false,
    notes: 'Use this for additional marketplaces, research systems, or listing tools.'
  }
];

let ocrWindowStartMs = Date.now();
let ocrCallsInWindow = 0;
let ocrLastCallStartMs = 0;
const NFL_TEAM_OPTIONS = [
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills', 'Carolina Panthers',
  'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns', 'Dallas Cowboys', 'Denver Broncos',
  'Detroit Lions', 'Green Bay Packers', 'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars',
  'Kansas City Chiefs', 'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
  'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants', 'New York Jets',
  'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers', 'Seattle Seahawks',
  'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders'
];

console.log(`[Card Automation UI] build=${FRONTEND_BUILD}`);

async function initializeAppBadge() {
  try {
    const backendUrl = await getBackendUrl()
    const res = await fetch(`${backendUrl}/config`)
    const data = await res.json()
    const badge = document.getElementById('envBadge')
    if (badge && data?.app?.environment) {
      const env = String(data.app.environment || '').toLowerCase()
      const isTestLike = env === 'test' || env === 'qa'
      const isProdLike = env === 'prod' || env === 'production' || env === 'live'
      const badgeLabel = isTestLike ? 'TEST' : (isProdLike ? 'PROD' : env.toUpperCase())

      badge.textContent = `[${badgeLabel}]`
      if (isTestLike) {
        badge.style.color = '#ff8800'
      } else if (isProdLike) {
        badge.style.color = '#00aa00'
      }
    }
  } catch (err) {
    console.warn('Could not load app environment badge', err)
  }
}

const dropZone = document.getElementById("dropZone");
const quickAddDropZone = document.getElementById("quickAddDropZone");
const fileInput = document.getElementById("fileInput");
const tableBody = document.getElementById("tableBody");
const aiToggle = document.getElementById("aiToggle");
const autoDetectSidesToggle = document.getElementById("autoDetectSidesToggle");
const taskProgress = document.getElementById("taskProgress");
const taskProgressLabel = document.getElementById("taskProgressLabel");
const taskProgressCount = document.getElementById("taskProgressCount");
const taskProgressBar = document.getElementById("taskProgressBar");
const taskProgressMessage = document.getElementById("taskProgressMessage");
const taskProgressCancel = document.getElementById("taskProgressCancel");
const imageViewerModal = document.getElementById("imageViewerModal");
const imageViewerImg = document.getElementById("imageViewerImg");
const imageViewerCaption = document.getElementById("imageViewerCaption");
const imageViewerClose = document.getElementById("imageViewerClose");
const imageViewerStage = document.getElementById("imageViewerStage");
const imageZoomIn = document.getElementById("imageZoomIn");
const imageZoomOut = document.getElementById("imageZoomOut");
const imageZoomReset = document.getElementById("imageZoomReset");
const imagePrev = document.getElementById("imagePrev");
const imageNext = document.getElementById("imageNext");
const sportSelect = document.getElementById("sportSelect");
const navHomeBtn = document.getElementById("navHomeBtn");
const navScanBtn = document.getElementById("navScanBtn");
const navInventoryBtn = document.getElementById("navInventoryBtn");
const navPricingBtn = document.getElementById("navPricingBtn");
const navListingsBtn = document.getElementById("navListingsBtn");
const navChecklistBtn = document.getElementById("navChecklistBtn");
const navProfileBtn = document.getElementById("navProfileBtn");
const accountProfileBtn = document.getElementById("accountProfileBtn");
const appHeader = document.querySelector('.header');
const appNav = document.querySelector('.app-nav');
const homeGoScanBtn = document.getElementById("homeGoScanBtn");
const homeGoInventoryBtn = document.getElementById("homeGoInventoryBtn");
const homePage = document.getElementById("homePage");
const scanPage = document.getElementById("scanPage");
const inventoryPage = document.getElementById("inventoryPage");
const pricingPage = document.getElementById("pricingPage");
const listingsPage = document.getElementById("listingsPage");
const checklistPage = document.getElementById("checklistPage");
const profilePage = document.getElementById("profilePage");
const saveInventoryBtn = document.getElementById("saveInventoryBtn");
const refreshInventoryBtn = document.getElementById("refreshInventoryBtn");
const openPricingAnalyzeBtn = document.getElementById("openPricingAnalyzeBtn");
const refreshListingsBtn = document.getElementById("refreshListingsBtn");
const loadPricingToListingsBtn = document.getElementById("loadPricingToListingsBtn");
const rescanListingsBtn = document.getElementById("rescanListingsBtn");
const inventoryBody = document.getElementById("inventoryBody");
const pricingBody = document.getElementById("pricingBody");
const refreshPricingBtn = document.getElementById("refreshPricingBtn");
const rescanScanBtn = document.getElementById("rescanScanBtn");
const rescanInventoryBtn = document.getElementById("rescanInventoryBtn");
const rescanPricingBtn = document.getElementById("rescanPricingBtn");
const pricingStatus = document.getElementById("pricingStatus");
const exportEbayCsvBtn = document.getElementById("exportEbayCsvBtn");
const verifyEbayFieldsBtn = document.getElementById("verifyEbayFieldsBtn");
const clearSportInventoryBtn = document.getElementById("clearSportInventoryBtn");
const clearAllInventoryBtn = document.getElementById("clearAllInventoryBtn");
const discardScanDraftBtn = document.getElementById("discardScanDraftBtn");
const inventoryStatus = document.getElementById("inventoryStatus");
const inventoryDetailModal = document.getElementById("inventoryDetailModal");
const closeInventoryDetailModalBtn = document.getElementById("closeInventoryDetailModalBtn");
const cancelInventoryDetailBtn = document.getElementById("cancelInventoryDetailBtn");
const saveInventoryDetailBtn = document.getElementById("saveInventoryDetailBtn");
const inventoryDetailSummary = document.getElementById("inventoryDetailSummary");
const inventoryDetailSportInput = document.getElementById("inventoryDetailSportInput");
const inventoryDetailSkuInput = document.getElementById("inventoryDetailSkuInput");
const inventoryDetailNameInput = document.getElementById("inventoryDetailNameInput");
const inventoryDetailTeamInput = document.getElementById("inventoryDetailTeamInput");
const inventoryDetailPositionInput = document.getElementById("inventoryDetailPositionInput");
const inventoryDetailSetInput = document.getElementById("inventoryDetailSetInput");
const inventoryDetailYearInput = document.getElementById("inventoryDetailYearInput");
const inventoryDetailCardNumberInput = document.getElementById("inventoryDetailCardNumberInput");
const inventoryDetailQuantityInput = document.getElementById("inventoryDetailQuantityInput");
const inventoryDetailParallelInput = document.getElementById("inventoryDetailParallelInput");
const inventoryDetailRookieSelect = document.getElementById("inventoryDetailRookieSelect");
const inventoryDetailAutographSelect = document.getElementById("inventoryDetailAutographSelect");
const inventoryDetailPickFromInput = document.getElementById("inventoryDetailPickFromInput");
const inventoryDetailFilenameInput = document.getElementById("inventoryDetailFilenameInput");
const inventoryDetailPictureUrlInput = document.getElementById("inventoryDetailPictureUrlInput");
const inventoryDetailTitleInput = document.getElementById("inventoryDetailTitleInput");
const inventoryDetailDescriptionInput = document.getElementById("inventoryDetailDescriptionInput");
const listingTemplateSelect = document.getElementById("listingTemplateSelect");
const listingCardIdInput = document.getElementById("listingCardIdInput");
const listingChaseCardIdInput = document.getElementById("listingChaseCardIdInput");
const buildListingDraftBtn = document.getElementById("buildListingDraftBtn");
const submitListingDraftBtn = document.getElementById("submitListingDraftBtn");
const cancelListingDraftBtn = document.getElementById("cancelListingDraftBtn");
const listingDraftOutput = document.getElementById("listingDraftOutput");
const listingStatus = document.getElementById("listingStatus");
const listingsListingTemplateSelect = document.getElementById("listingsListingTemplateSelect");
const listingsListingCardIdInput = document.getElementById("listingsListingCardIdInput");
const listingsListingChaseCardIdInput = document.getElementById("listingsListingChaseCardIdInput");
const listingsBuildListingDraftBtn = document.getElementById("listingsBuildListingDraftBtn");
const listingsSubmitListingDraftBtn = document.getElementById("listingsSubmitListingDraftBtn");
const listingsCancelListingDraftBtn = document.getElementById("listingsCancelListingDraftBtn");
const listingsListingDraftOutput = document.getElementById("listingsListingDraftOutput");
const quickAddFilesBtn = document.getElementById("quickAddFilesBtn");
const importPrefillModal = document.getElementById("importPrefillModal");
const closeImportPrefillModal = document.getElementById("closeImportPrefillModal");
const cancelImportPrefillBtn = document.getElementById("cancelImportPrefillBtn");
const confirmImportPrefillBtn = document.getElementById("confirmImportPrefillBtn");
const prefillImportSummary = document.getElementById("prefillImportSummary");
const prefillTeamInput = document.getElementById("prefillTeamInput");
const prefillSetInput = document.getElementById("prefillSetInput");
const prefillYearDetails = document.getElementById("prefillYearDetails");
const prefillYearSummary = document.getElementById("prefillYearSummary");
const prefillYearChecklist = document.getElementById("prefillYearChecklist");
const prefillTeamOptions = document.getElementById("prefillTeamOptions");
const prefillTeamChips = document.getElementById("prefillTeamChips");
const prefillSetChecklist = document.getElementById("prefillSetChecklist");
const clearPrefillSetsBtn = document.getElementById("clearPrefillSetsBtn");
const helpMenuToggle = document.getElementById("helpMenuToggle");
const helpMenuDropdown = document.getElementById("helpMenuDropdown");
const openFeedbackBtn = document.getElementById("openFeedbackBtn");
const openDefectBtn = document.getElementById("openDefectBtn");
const feedbackModal = document.getElementById("feedbackModal");
const closeFeedbackModal = document.getElementById("closeFeedbackModal");
const cancelFeedbackBtn = document.getElementById("cancelFeedbackBtn");
const submitFeedbackBtn = document.getElementById("submitFeedbackBtn");
const feedbackModalTitle = document.getElementById("feedbackModalTitle");
const feedbackTitleInput = document.getElementById("feedbackTitleInput");
const feedbackEmailInput = document.getElementById("feedbackEmailInput");
const feedbackMessageInput = document.getElementById("feedbackMessageInput");
const feedbackStatus = document.getElementById("feedbackStatus");
const profileHeroStatus = document.getElementById("profileHeroStatus");
const profileAuthPanel = document.getElementById("profileAuthPanel");
const profileWorkspace = document.getElementById("profileWorkspace");
const signupDisplayNameInput = document.getElementById("signupDisplayNameInput");
const signupEmailInput = document.getElementById("signupEmailInput");
const signupPasswordInput = document.getElementById("signupPasswordInput");
const rememberMeSignupCheckbox = document.getElementById("rememberMeSignupCheckbox");
const signupSubmitBtn = document.getElementById("signupSubmitBtn");
const loginEmailInput = document.getElementById("loginEmailInput");
const loginPasswordInput = document.getElementById("loginPasswordInput");
const rememberMeCheckbox = document.getElementById("rememberMeCheckbox");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const showForgotPasswordLink = document.getElementById("showForgotPasswordLink");
const showSignupLink = document.getElementById("showSignupLink");
const backToLoginFromSignupLink = document.getElementById("backToLoginFromSignupLink");
const backToLoginFromResetLink = document.getElementById("backToLoginFromResetLink");
const authPortalTitle = document.getElementById("authPortalTitle");
const authPortalSubtitle = document.getElementById("authPortalSubtitle");
const authLoginPortal = document.getElementById("authLoginPortal");
const authSignupPortal = document.getElementById("authSignupPortal");
const authResetPortal = document.getElementById("authResetPortal");
const profileAuthStatus = document.getElementById("profileAuthStatus");
const recoveryIdentifierInput = document.getElementById("recoveryIdentifierInput");
const findAccountBtn = document.getElementById("findAccountBtn");
const recoveryEmailInput = document.getElementById("recoveryEmailInput");
const recoveryDisplayNameInput = document.getElementById("recoveryDisplayNameInput");
const recoveryNewPasswordInput = document.getElementById("recoveryNewPasswordInput");
const resetPasswordBtn = document.getElementById("resetPasswordBtn");
const profileAccountSummary = document.getElementById("profileAccountSummary");
const profileDisplayNameInput = document.getElementById("profileDisplayNameInput");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const logoutBtn = document.getElementById("logoutBtn");
const googleLinkBtn = document.getElementById("googleLinkBtn");
const profileConnectionProviderSelect = document.getElementById("profileConnectionProviderSelect");
const profileCustomProviderRow = document.getElementById("profileCustomProviderRow");
const profileCustomProviderInput = document.getElementById("profileCustomProviderInput");
const profileConnectionCapabilitySelect = document.getElementById("profileConnectionCapabilitySelect");
const profileConnectionStatusSelect = document.getElementById("profileConnectionStatusSelect");
const profileConnectionAuthTypeSelect = document.getElementById("profileConnectionAuthTypeSelect");
const profileConnectionAccountLabelInput = document.getElementById("profileConnectionAccountLabelInput");
const profileConnectionNotesInput = document.getElementById("profileConnectionNotesInput");
const saveConnectionBtn = document.getElementById("saveConnectionBtn");
const resetConnectionFormBtn = document.getElementById("resetConnectionFormBtn");
const profileConnectionsList = document.getElementById("profileConnectionsList");
const checklistStatus = document.getElementById("checklistStatus");
const checklistImportYear = document.getElementById("checklistImportYear");
const checklistImportBrand = document.getElementById("checklistImportBrand");
const checklistImportSetName = document.getElementById("checklistImportSetName");
const checklistImportFile = document.getElementById("checklistImportFile");
const checklistChooseFileBtn = document.getElementById("checklistChooseFileBtn");
const checklistImportBtn = document.getElementById("checklistImportBtn");
const checklistImportUrl = document.getElementById("checklistImportUrl");
const checklistImportUrlBtn = document.getElementById("checklistImportUrlBtn");
const checklistPasteInput = document.getElementById("checklistPasteInput");
const oddsImportFile = document.getElementById("oddsImportFile");
const oddsChooseFileBtn = document.getElementById("oddsChooseFileBtn");
const oddsImportBtn = document.getElementById("oddsImportBtn");
const oddsImportUrl = document.getElementById("oddsImportUrl");
const oddsImportUrlBtn = document.getElementById("oddsImportUrlBtn");
const oddsPasteInput = document.getElementById("oddsPasteInput");
const checklistYearFilter = document.getElementById("checklistYearFilter");
const checklistSetSearchInput = document.getElementById("checklistSetSearchInput");
const checklistSearchInput = document.getElementById("checklistSearchInput");
const checklistOddsCategoryFilter = document.getElementById("checklistOddsCategoryFilter");
const checklistRookieFilter = document.getElementById("checklistRookieFilter");
const checklistCustomSortField = document.getElementById("checklistCustomSortField");
const checklistCustomSortDirection = document.getElementById("checklistCustomSortDirection");
const checklistCustomFilterField = document.getElementById("checklistCustomFilterField");
const checklistCustomFilterOperator = document.getElementById("checklistCustomFilterOperator");
const checklistCustomFilterValue = document.getElementById("checklistCustomFilterValue");
const checklistCustomFilterClearBtn = document.getElementById("checklistCustomFilterClearBtn");
const checklistViewTabBtn = document.getElementById("checklistViewTabBtn");
const oddsViewTabBtn = document.getElementById("oddsViewTabBtn");
const checklistDataPanel = document.getElementById("checklistDataPanel");
const oddsDataPanel = document.getElementById("oddsDataPanel");
const checklistDataBody = document.getElementById("checklistDataBody");
const checklistOddsBody = document.getElementById("checklistOddsBody");
const checklistSortHeaders = Array.from(document.querySelectorAll('#checklistDataTable thead th[data-sort-key]'));
const oddsSortHeaders = Array.from(document.querySelectorAll('#oddsDataTable thead th[data-sort-key]'));
const checklistSetsBody = document.getElementById("checklistSetsBody");
const refreshChecklistCatalogBtn = document.getElementById("refreshChecklistCatalogBtn");
const refreshChecklistSetDetailBtn = document.getElementById("refreshChecklistSetDetailBtn");
const openToppsChecklistBtn = document.getElementById("openToppsChecklistBtn");
const openToppsOddsBtn = document.getElementById("openToppsOddsBtn");
const syncOpenChecklistBtn = document.getElementById("syncOpenChecklistBtn");
const checklistSetModal = document.getElementById("checklistSetModal");
const closeChecklistSetModalBtn = document.getElementById("closeChecklistSetModalBtn");
const checklistSetModalTitle = document.getElementById("checklistSetModalTitle");
const checklistImportProfileModal = document.getElementById("checklistImportProfileModal");
const closeChecklistImportProfileModalBtn = document.getElementById("closeChecklistImportProfileModalBtn");
const cancelChecklistImportProfileBtn = document.getElementById("cancelChecklistImportProfileBtn");
const saveChecklistImportProfileBtn = document.getElementById("saveChecklistImportProfileBtn");
const checklistImportProfileSummary = document.getElementById("checklistImportProfileSummary");
const checklistImportProfileSetName = document.getElementById("checklistImportProfileSetName");
const checklistImportProfileYear = document.getElementById("checklistImportProfileYear");
const checklistImportProfileManufacturer = document.getElementById("checklistImportProfileManufacturer");
const checklistImportProfileCustomColumns = document.getElementById("checklistImportProfileCustomColumns");
const checklistImportProfileNotes = document.getElementById("checklistImportProfileNotes");
const checklistOwnedCardModal = document.getElementById("checklistOwnedCardModal");
const closeChecklistOwnedCardModalBtn = document.getElementById("closeChecklistOwnedCardModalBtn");
const cancelChecklistOwnedCardBtn = document.getElementById("cancelChecklistOwnedCardBtn");
const saveChecklistOwnedCardBtn = document.getElementById("saveChecklistOwnedCardBtn");
const checklistOwnedCardSummary = document.getElementById("checklistOwnedCardSummary");
const checklistOwnedSkuInput = document.getElementById("checklistOwnedSkuInput");
const checklistOwnedQuantityInput = document.getElementById("checklistOwnedQuantityInput");
const checklistOwnedParallelDisplay = document.getElementById("checklistOwnedParallelDisplay");
const checklistOwnedRookieSelect = document.getElementById("checklistOwnedRookieSelect");
const checklistOwnedAutographSelect = document.getElementById("checklistOwnedAutographSelect");
const checklistOwnedNotesInput = document.getElementById("checklistOwnedNotesInput");

let viewerScale = 1;
let viewerOffsetX = 0;
let viewerOffsetY = 0;
let isViewerDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let viewerItems = [];
let viewerIndex = -1;
let progressCancelHandler = null;
let currentUploadSession = null;
let pendingImportFiles = [];
let selectedPrefillTeams = [];
let selectedPrefillSets = [];
let selectedPrefillYears = [];
let skuSessionCursor = null;
let listingTemplatesLoaded = false;
let catalogSetOptions = [];
let scanDraftPersistTimer = null;
let scanDraftPersistInFlight = false;
let scanDraftPersistFailed = false;
let scanDraftDbPromise = null;
let scanDraftRestoreInProgress = false;
let forceSkuResetOnNextImport = false;
let activeFeedbackType = 'feedback';
let checklistSetsCache = [];
let checklistCardsCache = [];
let checklistOddsCache = [];
let checklistVisibleRowsCache = [];
let checklistSortState = { key: 'cardNumber', direction: 'asc' }
let oddsSortState = { key: 'category', direction: 'asc' }
let activeChecklistView = 'checklist';
let activeChecklistSetId = '';
let activeChecklistSetMeta = null;
let checklistOwnedCardKeys = new Set()
let pendingChecklistOwnedCardResolve = null
let pendingChecklistOwnedCardItem = null
let pendingChecklistImportProfileContext = null
let pendingChecklistImportProfileResolve = null
let selectedChecklistFile = null;
let selectedOddsFile = null;
const CLIENT_LOG_LIMIT = 120;
const clientRuntimeLogs = [];
const LISTING_DRAFT_DEFAULT_MESSAGE = 'Select a template and enter a card ID or SKU to generate a listing draft.'
const LISTING_SAFE_PLACEHOLDER = 'N/A'
const PRICING_STORAGE_KEY = 'cardPilotPricingById'
const PRICING_ESTIMATE_CACHE_KEY = 'cardPilotPricingEstimateByFingerprint'
const CHECKLIST_IMPORT_PROFILE_STORAGE_KEY = 'cardPilotChecklistImportProfiles'
const CHECKLIST_OWNED_STORAGE_KEY = 'cardPilotChecklistOwnedBySet'
const OPEN_CHECKLIST_SUPPORTED_SPORTS = new Set(['Baseball'])
let inventoryRowsCache = []
let inventoryEditingRowId = ''
let pricingEstimateByFingerprint = {}
let activeInventoryDetailId = ''
let authToken = ''
let rememberMeEnabled = false
let authState = {
  user: null,
  session: null,
  connections: [],
  providers: DEFAULT_CONNECTION_PROVIDERS.map((provider) => ({ ...provider }))
}
let editingConnectionProviderSlug = ''
let oauthReturnContextHandled = false
const APP_PAGES = ['home', 'scan', 'inventory', 'pricing', 'listings', 'checklist', 'profile']

function isUserAuthenticated() {
  return Boolean(authState?.user?.id)
}

function normalizeAppPage(value) {
  const page = String(value || '').trim().toLowerCase()
  return APP_PAGES.includes(page) ? page : 'home'
}

function resolveAllowedPage(page) {
  const safePage = normalizeAppPage(page)
  if (safePage === 'profile') return 'profile'
  return isUserAuthenticated() ? safePage : 'profile'
}

function sanitizeSubmitPayload(value, path = '', replacements = []) {
  if (value === null || value === undefined) {
    const key = path || 'value'
    replacements.push(key)
    return LISTING_SAFE_PLACEHOLDER
  }

  if (typeof value === 'string') {
    if (value.trim()) return value
    const key = path || 'value'
    replacements.push(key)
    return LISTING_SAFE_PLACEHOLDER
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeSubmitPayload(item, `${path}[${index}]`, replacements))
  }

  if (typeof value === 'object') {
    const next = {}
    for (const [key, nested] of Object.entries(value)) {
      const nestedPath = path ? `${path}.${key}` : key
      next[key] = sanitizeSubmitPayload(nested, nestedPath, replacements)
    }
    return next
  }

  return value
}

function uniqueValues(values = []) {
  return [...new Set(Array.isArray(values) ? values : [])]
}

function currentUserScopeKey() {
  return String(authState?.user?.id || 'anonymous').trim() || 'anonymous'
}

function scopedStorageKey(baseKey) {
  return `${baseKey}:${currentUserScopeKey()}`
}

function getUrlContext() {
  if (typeof window === 'undefined') return { page: '', oauth: '', oauthMessage: '' }
  const params = new URLSearchParams(window.location.search || '')
  return {
    page: String(params.get('page') || '').trim().toLowerCase(),
    oauth: String(params.get('oauth') || '').trim().toLowerCase(),
    oauthMessage: String(params.get('oauthMessage') || '').trim()
  }
}

function clearUrlContext() {
  if (typeof window === 'undefined' || !window.history?.replaceState) return
  const nextUrl = `${window.location.pathname}${window.location.hash || ''}`
  window.history.replaceState({}, document.title, nextUrl)
}

function applyOAuthReturnContext() {
  if (oauthReturnContextHandled) return
  const context = getUrlContext()
  if (!context.oauth) return

  oauthReturnContextHandled = true
  const requestedPage = normalizeAppPage(context.page || (context.oauth.includes('success') ? 'home' : 'profile'))
  setActivePage(requestedPage)
  showProfileStatus(
    context.oauthMessage || (context.oauth === 'ebay-success' ? 'eBay OAuth connected successfully.' : 'OAuth flow finished.'),
    context.oauth.includes('error')
  )
  clearUrlContext()
}

function getPricingState() {
  try {
    const raw = localStorage.getItem(scopedStorageKey(PRICING_STORAGE_KEY))
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function getPricingEstimateState() {
  try {
    const raw = localStorage.getItem(scopedStorageKey(PRICING_ESTIMATE_CACHE_KEY))
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function setPricingEstimateState(nextState) {
  localStorage.setItem(scopedStorageKey(PRICING_ESTIMATE_CACHE_KEY), JSON.stringify(nextState || {}))
}

function setPricingState(nextState) {
  localStorage.setItem(scopedStorageKey(PRICING_STORAGE_KEY), JSON.stringify(nextState || {}))
}

function showPricingStatus(message, isError = false) {
  if (!pricingStatus) return
  pricingStatus.style.display = message ? 'block' : 'none'
  pricingStatus.style.color = isError ? '#a52020' : '#3f4f8e'
  pricingStatus.textContent = message || ''
}

function showListingStatus(message, isError = false) {
  if (!listingStatus) return
  listingStatus.style.display = message ? 'block' : 'none'
  listingStatus.style.color = isError ? '#a52020' : '#3f4f8e'
  listingStatus.textContent = message || ''
}

function showChecklistStatus(message, isError = false) {
  if (!checklistStatus) return
  checklistStatus.style.display = message ? 'block' : 'none'
  checklistStatus.style.color = isError ? '#a52020' : '#3f4f8e'
  checklistStatus.textContent = message || ''
}

function normalizeChecklistYear(value) {
  const year = String(value || '').trim()
  if (ALLOWED_CARD_YEARS.includes(year)) return year
  return ''
}

function checklistSetLabel(item = {}) {
  const year = String(item?.year || '').trim()
  const brand = String(item?.brand || '').trim()
  const setName = String(item?.setName || '').trim()
  const head = [year, brand, setName].filter(Boolean).join(' ')
  if (!head) return item?.id || 'Unknown Set'
  const counts = []
  if (Number(item?.checklistCount || 0) > 0) counts.push(`${Number(item.checklistCount)} cards`)
  if (Number(item?.oddsCount || 0) > 0) counts.push(`${Number(item.oddsCount)} odds`)
  return counts.length ? `${head} (${counts.join(', ')})` : head
}

function setChecklistView(view = 'checklist') {
  activeChecklistView = String(view || '').toLowerCase() === 'odds' ? 'odds' : 'checklist'

  if (checklistViewTabBtn) {
    const isActive = activeChecklistView === 'checklist'
    checklistViewTabBtn.classList.toggle('active', isActive)
    checklistViewTabBtn.setAttribute('aria-selected', isActive ? 'true' : 'false')
  }
  if (oddsViewTabBtn) {
    const isActive = activeChecklistView === 'odds'
    oddsViewTabBtn.classList.toggle('active', isActive)
    oddsViewTabBtn.setAttribute('aria-selected', isActive ? 'true' : 'false')
  }
  checklistDataPanel?.classList.toggle('active', activeChecklistView === 'checklist')
  oddsDataPanel?.classList.toggle('active', activeChecklistView === 'odds')
}

function isRookieFlag(value) {
  const raw = String(value || '').trim()
  if (!raw) return false
  return /^(yes|y|true|1|rookie|rc)$/i.test(raw)
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function normalizeCell(value) {
  return String(value || '').replace(/\r/g, '').trim()
}

function splitDelimitedLine(line, delimiter = ',') {
  const out = []
  let current = ''
  let quoteOpen = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (quoteOpen && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        quoteOpen = !quoteOpen
      }
      continue
    }
    if (ch === delimiter && !quoteOpen) {
      out.push(current)
      current = ''
      continue
    }
    current += ch
  }
  out.push(current)
  return out
}

function parseDelimitedRows(rawText = '') {
  const text = String(rawText || '').replace(/^\uFEFF/, '')
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return []

  const delimiter = lines[0].includes('\t') ? '\t' : ','
  return lines.map((line) => splitDelimitedLine(line, delimiter).map((cell) => normalizeCell(cell)))
}

function rowValueByAliases(row = {}, aliases = []) {
  const keys = Object.keys(row)
  for (const alias of aliases) {
    const aliasKey = normalizeHeader(alias)
    const key = keys.find((candidate) => normalizeHeader(candidate) === aliasKey)
    if (!key) continue
    const value = normalizeCell(row[key])
    if (value) return value
  }
  return ''
}

function rowsToObjects(parsedRows = []) {
  if (!parsedRows.length) return []
  const [first = [], ...rest] = parsedRows
  const normalizedHeaders = first.map((header) => normalizeHeader(header))
  const headerLike = normalizedHeaders.some((header) => [
    'cardnumber', 'player', 'name', 'team', 'parallel', 'insert', 'odds', 'category', 'packrate'
  ].includes(header))

  const headers = headerLike
    ? first.map((header, index) => String(header || `column${index + 1}`).trim() || `column${index + 1}`)
    : first.map((_, index) => `column${index + 1}`)
  const rows = headerLike ? rest : parsedRows

  return rows.map((cells) => {
    const out = {}
    headers.forEach((header, index) => {
      out[header] = normalizeCell(cells[index] || '')
    })
    return out
  }).filter((row) => Object.values(row).some((value) => String(value || '').trim()))
}

function positionalChecklistValues(row = {}) {
  const c1 = normalizeCell(row?.column1)
  const c2 = normalizeCell(row?.column2)
  const c3 = normalizeCell(row?.column3)
  const c4 = normalizeCell(row?.column4)
  return {
    cardNumber: c1,
    player: c2,
    team: c3,
    rookie: c4
  }
}

function normalizeRookieValue(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^(yes|y|true|1|rookie|rc)$/i.test(raw)) return 'Yes'
  if (/^(no|n|false|0)$/i.test(raw)) return 'No'
  return raw
}

function parseChecklistRowsFromRaw(rawText = '') {
  const parsedRows = parseDelimitedRows(rawText)
  const hasMultiColumnRows = parsedRows.some((cells) => {
    const nonEmpty = (Array.isArray(cells) ? cells : []).filter((cell) => normalizeCell(cell))
    return nonEmpty.length >= 2
  })
  const objects = rowsToObjects(parsedRows)
  const fromDelimited = objects.map((row) => ({
    cardNumber: rowValueByAliases(row, ['card number', 'card#', 'card #', 'number', '#', 'card']) || positionalChecklistValues(row).cardNumber,
    player: rowValueByAliases(row, ['player', 'name']) || positionalChecklistValues(row).player,
    team: rowValueByAliases(row, ['team', 'club']) || positionalChecklistValues(row).team,
    position: rowValueByAliases(row, ['position', 'pos']),
    parallel: rowValueByAliases(row, ['parallel', 'variation', 'variant']),
    rookie: normalizeRookieValue(rowValueByAliases(row, ['rookie', 'rc']) || positionalChecklistValues(row).rookie)
  })).filter((row) => row.player || row.cardNumber)

  if (hasMultiColumnRows && fromDelimited.length) return fromDelimited

  const lines = String(rawText || '').split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const rows = []
  const seen = new Set()
  for (const line of lines) {
    const match = line.match(/^([A-Z]{1,5}-\d{1,4}[A-Z]?|\d{1,4}[A-Z]?)(.+)$/)
    if (!match) continue
    const cardNumber = normalizeCell(match[1])
    const body = normalizeCell(match[2])
    if (!cardNumber || !body) continue
    const key = `${cardNumber}|${body.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ cardNumber, player: body, team: '', position: '', parallel: '', rookie: '' })
  }
  return rows
}

function parseOddsRowsFromRaw(rawText = '') {
  const parsedRows = parseDelimitedRows(rawText)
  const objects = rowsToObjects(parsedRows)
  return objects.map((row) => ({
    category: rowValueByAliases(row, ['category', 'type', 'group']),
    itemName: rowValueByAliases(row, ['insert', 'item', 'item name', 'name', 'card type']),
    oddsText: rowValueByAliases(row, ['odds', 'odds text', 'pack odds']),
    packRate: rowValueByAliases(row, ['pack rate', 'rate', 'collector rate']),
    notes: rowValueByAliases(row, ['notes', 'note'])
  })).filter((row) => row.itemName || row.oddsText || row.packRate)
}

async function fileToText(file) {
  if (!file) return ''
  const ext = String(file?.name || '').toLowerCase()
  if (ext.endsWith('.json')) {
    return String(await file.text())
  }
  return String(await file.text())
}

function isSpreadsheetFileName(filename = '') {
  const name = String(filename || '').toLowerCase()
  return name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm') || name.endsWith('.xlsb')
}

async function parseApiJsonResponse(response, failureMessage = 'Request failed') {
  const raw = await response.text()
  if (!raw) return {}

  try {
    return JSON.parse(raw)
  } catch {
    const trimmed = raw.trim().toLowerCase()
    if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
      throw new Error(`${failureMessage}: server returned HTML instead of JSON. Verify backend URL and confirm backend is running.`)
    }
    throw new Error(`${failureMessage}: server returned an invalid JSON response.`)
  }
}

function readChecklistSetForm() {
  const year = normalizeChecklistYear(checklistImportYear?.value)
  const brand = String(checklistImportBrand?.value || '').trim()
  const setName = String(checklistImportSetName?.value || '').trim()
  return {
    sport: activeSport(),
    year,
    brand,
    setName,
    source: 'topps_import_ui'
  }
}

function inferChecklistMetadataFromUrl(urlValue = '') {
  const raw = String(urlValue || '').trim()
  if (!raw) return { brand: '', setName: '' }

  let parsed = null
  try {
    parsed = new URL(raw)
  } catch {
    return { brand: '', setName: '' }
  }

  const sourceText = `${parsed.hostname} ${parsed.pathname}`.toLowerCase()
  let brand = ''
  if (sourceText.includes('topps')) brand = 'Topps'
  else if (sourceText.includes('panini')) brand = 'Panini'
  else if (sourceText.includes('upperdeck') || sourceText.includes('upper deck')) brand = 'Upper Deck'
  else if (sourceText.includes('leaf')) brand = 'Leaf'

  const fileName = decodeURIComponent(parsed.pathname || '').split('/').filter(Boolean).pop() || ''
  const base = fileName.replace(/\.[a-z0-9]+$/i, '')
  const setName = base
    .replace(/[._-]+/g, ' ')
    .replace(/\b(checklist|pack\s*odds|odds|football|basketball|baseball|hobby|hta|pdf)\b/gi, ' ')
    .replace(/\b(19\d{2}|20\d{2})\b/g, ' ')
    .replace(/\b(topps|panini|upper\s*deck|leaf)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    brand,
    setName: setName
      ? setName.split(' ').map((token) => token ? `${token.charAt(0).toUpperCase()}${token.slice(1)}` : '').join(' ').trim()
      : ''
  }
}

function validateChecklistSetForm(options = {}) {
  const set = readChecklistSetForm()
  const importUrl = normalizeRemoteImportUrl(options?.url || '')
  const inferred = importUrl ? inferChecklistMetadataFromUrl(importUrl) : { brand: '', setName: '' }
  if (!set.brand && inferred.brand) set.brand = inferred.brand
  if (!set.setName && inferred.setName) set.setName = inferred.setName

  if (importUrl) {
    // URL imports should not fail only because metadata tokens are missing in filename/host.
    if (!set.brand) set.brand = 'Topps'
    if (!set.setName) set.setName = 'Imported Checklist'
  }

  if (!set.year) {
    throw new Error('Set year must be 2025, 2026, or 2025-2026.')
  }
  if (!set.brand) {
    throw new Error('Brand is required before importing.')
  }
  if (!set.setName) {
    throw new Error('Set name is required before importing.')
  }
  return set
}

async function parseChecklistImportPayload() {
  const pasted = String(checklistPasteInput?.value || '').trim()
  if (!pasted) return []
  return parseChecklistRowsFromRaw(pasted)
}

async function parseOddsImportPayload() {
  const pasted = String(oddsPasteInput?.value || '').trim()
  if (!pasted) return []
  return parseOddsRowsFromRaw(pasted)
}

function normalizeRemoteImportUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    if (!['http:', 'https:'].includes(parsed.protocol)) return ''
    return parsed.toString()
  } catch {
    return ''
  }
}

async function importChecklistFromSelectedFile(set) {
  if (!selectedChecklistFile) return null

  const filename = String(selectedChecklistFile?.name || '').toLowerCase()
  const requiresBinaryUpload = filename.endsWith('.pdf') || isSpreadsheetFileName(filename)
  if (!requiresBinaryUpload) {
    const text = await fileToText(selectedChecklistFile)
    if (filename.endsWith('.json')) {
      const parsed = JSON.parse(text)
      const cards = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.cards) ? parsed.cards : [])
      if (!cards.length) throw new Error('No checklist rows found in the selected JSON file.')
      const res = await fetchBackend('/catalog/checklist/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set, cards })
      })
      const data = await parseApiJsonResponse(res, 'Checklist import failed')
      if (!res.ok) throw new Error(data?.error || 'Checklist import failed')
      return data
    }

    const cards = parseChecklistRowsFromRaw(text)
    if (!cards.length) throw new Error('No checklist rows found in the selected file.')
    const res = await fetchBackend('/catalog/checklist/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ set, cards })
    })
    const data = await parseApiJsonResponse(res, 'Checklist import failed')
    if (!res.ok) throw new Error(data?.error || 'Checklist import failed')
    return data
  }

  const formData = new FormData()
  formData.append('file', selectedChecklistFile)
  formData.append('sport', set.sport)
  formData.append('year', set.year)
  formData.append('brand', set.brand)
  formData.append('setName', set.setName)
  formData.append('source', set.source)
  formData.append('notes', String(set.notes || ''))

  const res = await fetchBackend('/catalog/checklist/import-file', {
    method: 'POST',
    body: formData
  })
  const data = await parseApiJsonResponse(res, 'Checklist file import failed')
  if (!res.ok) throw new Error(data?.error || 'Checklist file import failed')
  return data
}

async function importOddsFromSelectedFile(set) {
  if (!selectedOddsFile) return null

  const filename = String(selectedOddsFile?.name || '').toLowerCase()
  const requiresBinaryUpload = filename.endsWith('.pdf') || isSpreadsheetFileName(filename)
  if (!requiresBinaryUpload) {
    const text = await fileToText(selectedOddsFile)
    if (filename.endsWith('.json')) {
      const parsed = JSON.parse(text)
      const odds = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.odds) ? parsed.odds : [])
      if (!odds.length) throw new Error('No odds rows found in the selected JSON file.')
      const res = await fetchBackend('/catalog/odds/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set, odds })
      })
      const data = await parseApiJsonResponse(res, 'Odds import failed')
      if (!res.ok) throw new Error(data?.error || 'Odds import failed')
      return data
    }

    const odds = parseOddsRowsFromRaw(text)
    if (!odds.length) throw new Error('No odds rows found in the selected file.')
    const res = await fetchBackend('/catalog/odds/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ set, odds })
    })
    const data = await parseApiJsonResponse(res, 'Odds import failed')
    if (!res.ok) throw new Error(data?.error || 'Odds import failed')
    return data
  }

  const formData = new FormData()
  formData.append('file', selectedOddsFile)
  formData.append('sport', set.sport)
  formData.append('year', set.year)
  formData.append('brand', set.brand)
  formData.append('setName', set.setName)
  formData.append('source', set.source)
  formData.append('notes', String(set.notes || ''))

  const res = await fetchBackend('/catalog/odds/import-file', {
    method: 'POST',
    body: formData
  })
  const data = await parseApiJsonResponse(res, 'Odds file import failed')
  if (!res.ok) throw new Error(data?.error || 'Odds file import failed')
  return data
}

async function syncOpenChecklistPopularSets() {
  try {
    if (!OPEN_CHECKLIST_SUPPORTED_SPORTS.has(activeSport())) {
      showChecklistStatus(`Open Checklist sync is currently available for ${Array.from(OPEN_CHECKLIST_SUPPORTED_SPORTS).join(', ')} only.`, true)
      return
    }

    showChecklistStatus('Syncing Open Checklist sets and subsets...')
    const res = await fetchBackend('/catalog/open-checklist/sync-popular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sport: activeSport(),
        limit: 50,
        includeSubsets: true
      })
    })

    const data = await parseApiJsonResponse(res, 'Open Checklist sync failed')
    if (!res.ok) {
      const availableSports = Array.isArray(data?.availableSports) ? data.availableSports.filter(Boolean) : []
      const availableNote = availableSports.length ? ` Available repo sports: ${availableSports.join(', ')}.` : ''
      throw new Error(`${data?.error || 'Open Checklist sync failed'}${availableNote}`)
    }

    await loadChecklistCatalogData({ quiet: true })

    const selectedCount = Number(data?.selectedCount || 0)
    const importedCount = Number(data?.importedCount || 0)
    const parsedRows = Number(data?.parsedRows || 0)
    const failedCount = Number(data?.failedCount || 0)
    const failedSets = Array.isArray(data?.failedSets) ? data.failedSets : []
    const failedSetNote = failedSets
      .slice(0, 3)
      .map((item) => {
        const slug = String(item?.slug || item?.name || '').trim()
        const message = String(item?.error || '').trim()
        if (!slug && !message) return ''
        if (!slug) return message
        if (!message) return slug
        return `${slug}: ${message}`
      })
      .filter(Boolean)
      .join(' | ')
    const failureNote = failedCount > 0
      ? ` ${failedCount} set(s) failed.${failedSetNote ? ` Sample failures: ${failedSetNote}` : ''}`
      : ''
    showChecklistStatus(`Open Checklist sync complete: ${importedCount}/${selectedCount || importedCount} set(s) imported, ${parsedRows} row(s) processed with subsets enabled.${failureNote}`)
  } catch (err) {
    showChecklistStatus(`Open Checklist sync failed: ${err.message || 'Unknown error'}`, true)
  }
}

async function importChecklistFromUrl() {
  try {
    const url = normalizeRemoteImportUrl(checklistImportUrl?.value)
    if (!url) {
      throw new Error('Enter a valid checklist URL first.')
    }
    const profile = await ensureChecklistImportProfileBeforeIngest({
      sourceType: 'checklist url',
      sourceUrl: url,
      sport: activeSport(),
      year: checklistImportYear?.value,
      setName: checklistImportSetName?.value,
      manufacturer: checklistImportBrand?.value
    })
    if (profile === null) return

    const set = validateChecklistSetForm({ url })
    const profileNotes = buildChecklistImportProfileNotes(profile || {})
    if (profileNotes) set.notes = profileNotes

    showChecklistStatus('Fetching checklist URL and parsing content...')
    const res = await fetchBackend('/catalog/checklist/import-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ set, url })
    })
    const data = await res.json()
    if (!res.ok) {
      const lowerError = String(data?.error || '').toLowerCase()
      const likelyBlocked = lowerError.includes('http 403') || lowerError.includes('fetch source url')
      if (!likelyBlocked) {
        throw new Error(data?.error || 'Checklist URL import failed')
      }

      // Fallback path: try browser fetch for pages that block backend fetches.
      const browserRes = await fetch(url)
      if (!browserRes.ok) {
        throw new Error(`${data?.error || 'Checklist URL import failed'}. Source site may block remote reads; try the direct PDF URL or download PDF and import as file.`)
      }
      const text = await browserRes.text()
      const cards = parseChecklistRowsFromRaw(text)
      if (!cards.length) {
        throw new Error('Could not parse checklist rows from URL content. Try the direct PDF URL or download PDF and import as file.')
      }

      const bulkRes = await fetchBackend('/catalog/checklist/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set, cards })
      })
      const bulkData = await bulkRes.json()
      if (!bulkRes.ok) {
        throw new Error(bulkData?.error || 'Checklist URL fallback import failed')
      }

      showChecklistStatus(`Checklist URL fallback import complete: ${bulkData.inserted || 0} inserted, ${bulkData.updated || 0} updated.`)
      await loadChecklistCatalogData({ quiet: true })
      return
    }

    showChecklistStatus(`Checklist URL import complete: ${data.inserted || 0} inserted, ${data.updated || 0} updated from ${data.sourceType || 'source'}.`)
    await loadChecklistCatalogData({ quiet: true })
  } catch (err) {
    showChecklistStatus(`Checklist URL import failed: ${err.message || 'Unknown error'}`, true)
  }
}

async function importOddsFromUrl() {
  try {
    const url = normalizeRemoteImportUrl(oddsImportUrl?.value)
    if (!url) {
      throw new Error('Enter a valid odds URL first.')
    }
    const profile = await ensureChecklistImportProfileBeforeIngest({
      sourceType: 'odds url',
      sourceUrl: url,
      sport: activeSport(),
      year: checklistImportYear?.value,
      setName: checklistImportSetName?.value,
      manufacturer: checklistImportBrand?.value
    })
    if (profile === null) return

    const set = validateChecklistSetForm({ url })
    const profileNotes = buildChecklistImportProfileNotes(profile || {})
    if (profileNotes) set.notes = profileNotes

    showChecklistStatus('Fetching odds URL and parsing content...')
    const res = await fetchBackend('/catalog/odds/import-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ set, url })
    })
    const data = await res.json()
    if (!res.ok) {
      const lowerError = String(data?.error || '').toLowerCase()
      const likelyBlocked = lowerError.includes('http 403') || lowerError.includes('fetch source url')
      if (!likelyBlocked) {
        throw new Error(data?.error || 'Odds URL import failed')
      }

      // Fallback path: try browser fetch for pages that block backend fetches.
      const browserRes = await fetch(url)
      if (!browserRes.ok) {
        throw new Error(`${data?.error || 'Odds URL import failed'}. Source site may block remote reads; try a direct odds PDF URL or download PDF and import as file.`)
      }
      const text = await browserRes.text()
      const odds = parseOddsRowsFromRaw(text)
      if (!odds.length) {
        throw new Error('Could not parse odds rows from URL content. Try a direct odds PDF URL or download PDF and import as file.')
      }

      const bulkRes = await fetchBackend('/catalog/odds/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set, odds })
      })
      const bulkData = await bulkRes.json()
      if (!bulkRes.ok) {
        throw new Error(bulkData?.error || 'Odds URL fallback import failed')
      }

      showChecklistStatus(`Odds URL fallback import complete: ${bulkData.inserted || 0} inserted, ${bulkData.updated || 0} updated.`)
      await loadChecklistCatalogData({ quiet: true })
      return
    }

    showChecklistStatus(`Odds URL import complete: ${data.inserted || 0} inserted, ${data.updated || 0} updated from ${data.sourceType || 'source'}.`)
    await loadChecklistCatalogData({ quiet: true })
  } catch (err) {
    showChecklistStatus(`Odds URL import failed: ${err.message || 'Unknown error'}`, true)
  }
}

function renderChecklistSetsTable(items = checklistSetsCache) {
  if (!checklistSetsBody) return
  if (!Array.isArray(items) || !items.length) {
    checklistSetsBody.innerHTML = '<tr><td colspan="7">No imported sets found for current filters.</td></tr>'
    return
  }

  checklistSetsBody.innerHTML = ''
  items.forEach((item) => {
    const importedDate = formatChecklistImportDate(item?.updatedAt || item?.createdAt)
    const row = document.createElement('tr')
    row.innerHTML = `
      <td>${item?.year || ''}</td>
      <td>${item?.brand || ''}</td>
      <td>${item?.setName || ''}</td>
      <td>${importedDate}</td>
      <td>${Number(item?.checklistCount || 0)}</td>
      <td>${Number(item?.oddsCount || 0)}</td>
      <td></td>
    `

    const actions = row.lastElementChild
    const openBtn = document.createElement('button')
    openBtn.type = 'button'
    openBtn.textContent = 'Open'
    openBtn.addEventListener('click', () => {
      openChecklistSetModal(item)
    })
    const deleteBtn = document.createElement('button')
    deleteBtn.type = 'button'
    deleteBtn.textContent = 'Delete'
    deleteBtn.className = 'secondary-btn'
    deleteBtn.addEventListener('click', async () => {
      await deleteChecklistSet(item)
    })
    actions.appendChild(openBtn)
    actions.appendChild(deleteBtn)
    checklistSetsBody.appendChild(row)
  })
}

function formatChecklistImportDate(value) {
  const parsed = Date.parse(String(value || '').trim())
  if (!Number.isFinite(parsed)) return '-'
  return new Date(parsed).toLocaleString()
}

async function deleteChecklistSet(setItem) {
  const setId = String(setItem?.id || '').trim()
  if (!setId) return

  const label = `${setItem?.year || ''} ${setItem?.brand || ''} ${setItem?.setName || ''}`.trim() || 'this set'
  const confirmed = window.confirm(`Delete ${label}? This removes checklist and odds rows for this set.`)
  if (!confirmed) return

  try {
    showChecklistStatus(`Deleting ${label}...`)
    const res = await fetchBackend(`/catalog/sets/${encodeURIComponent(setId)}`, {
      method: 'DELETE'
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error || 'Delete failed')
    }

    if (activeChecklistSetId && activeChecklistSetId === setId) {
      closeChecklistSetModal()
    }

    showChecklistStatus(`Deleted ${label}. Removed ${data?.deletedChecklistRows || 0} checklist row(s) and ${data?.deletedOddsRows || 0} odds row(s).`)
    await loadChecklistCatalogData({ quiet: true })
  } catch (err) {
    showChecklistStatus(`Set delete failed: ${err.message || 'Unknown error'}`, true)
  }
}

const checklistSortCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function normalizeSortValue(item, key) {
  if (!item || !key) return ''
  const raw = String(item?.[key] || '').trim()
  if (!raw) return ''

  if (key === 'cardNumber') {
    const match = raw.match(/^([A-Z]{1,8}-)?(\d{1,5})([A-Z]?)$/i)
    if (match) {
      const prefix = String(match[1] || '').toUpperCase()
      const number = String(match[2] || '').padStart(6, '0')
      const suffix = String(match[3] || '').toUpperCase()
      return `${prefix}${number}${suffix}`
    }
  }

  return raw
}

function applySortHeaderState(headers = [], state = {}) {
  headers.forEach((header) => {
    const key = String(header?.dataset?.sortKey || '').trim()
    const isActive = key && key === state?.key
    header.classList.toggle('sorted-asc', Boolean(isActive && state?.direction === 'asc'))
    header.classList.toggle('sorted-desc', Boolean(isActive && state?.direction === 'desc'))
    header.setAttribute('aria-sort', isActive ? (state?.direction === 'desc' ? 'descending' : 'ascending') : 'none')
  })
}

function checklistFieldValue(item, field) {
  const key = String(field || '').trim()
  if (!key) {
    return [
      item?.cardNumber,
      checklistInsertSetLabel(item),
      item?.player,
      item?.team,
      isChecklistRowRookie(item) ? 'rookie' : 'non-rookie'
    ].map((value) => String(value || '').trim()).join(' ')
  }

  if (key === 'insertSet') return String(checklistInsertSetLabel(item) || '').trim()
  if (key === 'rookie') return isChecklistRowRookie(item) ? 'rookie' : 'non-rookie'
  return String(item?.[key] || '').trim()
}

function applyChecklistCustomFilter(items = checklistCardsCache) {
  const rows = Array.isArray(items) ? items : []
  const field = String(checklistCustomFilterField?.value || '').trim()
  const operator = String(checklistCustomFilterOperator?.value || 'contains').trim()
  const rawValue = String(checklistCustomFilterValue?.value || '').trim()
  const value = rawValue.toLowerCase()

  if (!rows.length) return []

  if (operator === 'is_empty') {
    return rows.filter((item) => !checklistFieldValue(item, field))
  }
  if (operator === 'is_not_empty') {
    return rows.filter((item) => Boolean(checklistFieldValue(item, field)))
  }
  if (!value) return rows

  return rows.filter((item) => {
    const hay = checklistFieldValue(item, field).toLowerCase()
    if (!hay) return false
    if (operator === 'starts_with') return hay.startsWith(value)
    if (operator === 'equals') return hay === value
    if (operator === 'not_equals') return hay !== value
    return hay.includes(value)
  })
}

function syncChecklistSortControls() {
  if (checklistCustomSortField) checklistCustomSortField.value = checklistSortState?.key || 'cardNumber'
  if (checklistCustomSortDirection) checklistCustomSortDirection.value = checklistSortState?.direction || 'asc'
}

function checklistInsertSetLabel(item = {}) {
  const attrs = item?.attributes && typeof item.attributes === 'object' ? item.attributes : {}
  const parent = String(attrs?.parentSection || '').trim()
  const section = String(attrs?.section || '').trim()
  const subSection = String(attrs?.subSection || '').trim()
  const explicitPath = String(attrs?.sectionPath || '').trim()

  if (explicitPath) {
    const parts = explicitPath.split('>').map((part) => String(part || '').trim()).filter(Boolean)
    if (parts.length) {
      if (parts.length >= 2) return parts[1]
      return parts[0]
    }
  }

  return section || subSection || parent || 'General Checklist'
}

function sortChecklistItems(items = checklistCardsCache) {
  const sorted = Array.isArray(items) ? [...items] : []
  const key = checklistSortState?.key || 'cardNumber'
  const direction = checklistSortState?.direction === 'desc' ? -1 : 1
  sorted.sort((a, b) => {
    const av = key === 'insertSet' ? checklistInsertSetLabel(a) : normalizeSortValue(a, key)
    const bv = key === 'insertSet' ? checklistInsertSetLabel(b) : normalizeSortValue(b, key)
    const compared = checklistSortCollator.compare(av, bv)
    if (compared !== 0) return compared * direction

    const insertCompared = checklistSortCollator.compare(checklistInsertSetLabel(a), checklistInsertSetLabel(b))
    if (insertCompared !== 0) return insertCompared

    return checklistSortCollator.compare(String(a?.player || '').trim(), String(b?.player || '').trim()) * direction
  })
  return sorted
}

function sortOddsItems(items = checklistOddsCache) {
  const sorted = Array.isArray(items) ? [...items] : []
  const key = oddsSortState?.key || 'category'
  const direction = oddsSortState?.direction === 'desc' ? -1 : 1
  sorted.sort((a, b) => {
    const av = normalizeSortValue(a, key)
    const bv = normalizeSortValue(b, key)
    const compared = checklistSortCollator.compare(av, bv)
    if (compared !== 0) return compared * direction
    return checklistSortCollator.compare(String(a?.itemName || '').trim(), String(b?.itemName || '').trim()) * direction
  })
  return sorted
}

function toggleChecklistSort(sortKey) {
  const key = String(sortKey || '').trim()
  if (!key) return
  if (checklistSortState.key === key) {
    checklistSortState.direction = checklistSortState.direction === 'asc' ? 'desc' : 'asc'
  } else {
    checklistSortState = { key, direction: 'asc' }
  }
  syncChecklistSortControls()
  renderChecklistTable(checklistCardsCache)
}

function toggleOddsSort(sortKey) {
  const key = String(sortKey || '').trim()
  if (!key) return
  if (oddsSortState.key === key) {
    oddsSortState.direction = oddsSortState.direction === 'asc' ? 'desc' : 'asc'
  } else {
    oddsSortState = { key, direction: 'asc' }
  }
  renderOddsTable(checklistOddsCache)
}

function rowHasRookieAsterisk(item) {
  const playerText = String(item?.player || '').trim()
  return playerText.includes('*')
}

function isChecklistRowRookie(item) {
  return isRookieFlag(item?.rookie) || rowHasRookieAsterisk(item)
}

function applyChecklistRookieFilter(items = checklistCardsCache) {
  const mode = String(checklistRookieFilter?.value || 'all').trim().toLowerCase()
  if (!Array.isArray(items) || !items.length || mode === 'all') return Array.isArray(items) ? items : []

  if (mode === 'rookie') {
    return items.filter((item) => isChecklistRowRookie(item))
  }
  if (mode === 'non-rookie') {
    return items.filter((item) => !isChecklistRowRookie(item))
  }
  if (mode === 'star') {
    return items.filter((item) => rowHasRookieAsterisk(item))
  }
  return items
}

function normalizeOwnedToken(value) {
  return String(value || '').trim().toLowerCase()
}

function checklistOwnedCardKey(item = {}) {
  return [
    normalizeOwnedToken(item?.cardNumber),
    normalizeOwnedToken(item?.player),
    normalizeOwnedToken(item?.team)
  ].join('|')
}

function readChecklistOwnedStorage() {
  try {
    const raw = localStorage.getItem(scopedStorageKey(CHECKLIST_OWNED_STORAGE_KEY))
    const parsed = JSON.parse(String(raw || '{}'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeChecklistOwnedStorage(value = {}) {
  localStorage.setItem(scopedStorageKey(CHECKLIST_OWNED_STORAGE_KEY), JSON.stringify(value || {}))
}

function hydrateChecklistOwnedKeysForActiveSet() {
  const setId = String(activeChecklistSetId || '').trim()
  if (!setId) {
    checklistOwnedCardKeys = new Set()
    return
  }

  const stored = readChecklistOwnedStorage()
  const values = Array.isArray(stored?.[setId]) ? stored[setId] : []
  checklistOwnedCardKeys = new Set(values.map((value) => String(value || '').trim()).filter(Boolean))
}

function persistChecklistOwnedKeysForActiveSet() {
  const setId = String(activeChecklistSetId || '').trim()
  if (!setId) return
  const stored = readChecklistOwnedStorage()
  stored[setId] = Array.from(checklistOwnedCardKeys)
  writeChecklistOwnedStorage(stored)
}

function isChecklistCardOwned(item = {}) {
  return checklistOwnedCardKeys.has(checklistOwnedCardKey(item))
}

function markChecklistCardOwned(item = {}) {
  const key = checklistOwnedCardKey(item)
  if (!key || key === '||') return
  checklistOwnedCardKeys.add(key)
  persistChecklistOwnedKeysForActiveSet()
}

async function syncOwnedChecklistKeysFromInventoryForActiveSet() {
  if (!activeChecklistSetMeta?.setName) return

  const sport = encodeURIComponent(activeSport())
  const res = await fetchBackend(`/inventory?sport=${sport}`)
  const data = await parseApiJsonResponse(res, 'Inventory sync failed')
  if (!res.ok) return

  const activeSetName = normalizeOwnedToken(activeChecklistSetMeta?.setName)
  const activeYear = normalizeOwnedToken(activeChecklistSetMeta?.year)
  const items = Array.isArray(data?.items) ? data.items : []
  items.forEach((inventoryItem) => {
    const setName = normalizeOwnedToken(inventoryItem?.set)
    const year = normalizeOwnedToken(inventoryItem?.year)
    if (setName !== activeSetName) return
    if (activeYear && year && year !== activeYear) return

    markChecklistCardOwned({
      cardNumber: inventoryItem?.cardNumber,
      player: inventoryItem?.name,
      team: inventoryItem?.team
    })
  })
}

function closeChecklistOwnedCardModal(result = { confirmed: false, details: null }) {
  if (checklistOwnedCardModal) {
    checklistOwnedCardModal.classList.remove('active')
  }

  pendingChecklistOwnedCardItem = null
  const resolver = pendingChecklistOwnedCardResolve
  pendingChecklistOwnedCardResolve = null
  if (typeof resolver === 'function') {
    resolver(result)
  }
}

function collectChecklistOwnedCardInput() {
  return {
    sku: String(checklistOwnedSkuInput?.value || '').trim(),
    quantity: Number(checklistOwnedQuantityInput?.value || 1),
    rookie: String(checklistOwnedRookieSelect?.value || 'No').trim() || 'No',
    autograph: String(checklistOwnedAutographSelect?.value || 'No').trim() || 'No',
    notes: String(checklistOwnedNotesInput?.value || '').trim()
  }
}

function inferChecklistOwnedParallel(item = {}) {
  const explicitParallel = String(item?.parallel || '').trim()
  if (explicitParallel) return explicitParallel

  const insertSet = String(checklistInsertSetLabel(item) || '').trim()
  if (!insertSet) return 'Base'

  const normalized = insertSet.toLowerCase()
  if (
    normalized === 'base' ||
    normalized === 'base set' ||
    normalized === 'general checklist' ||
    normalized.includes('base')
  ) {
    return 'Base'
  }

  return insertSet
}

function buildInventoryCardFromChecklist(item = {}, details = {}) {
  const year = String(activeChecklistSetMeta?.year || '').trim()
  const setName = String(activeChecklistSetMeta?.setName || '').trim()
  const insertSet = checklistInsertSetLabel(item)
  const cardNumber = String(item?.cardNumber || '').trim()
  const name = String(item?.player || '').trim()
  const team = String(item?.team || '').trim()
  const quantity = Number.isFinite(details?.quantity) ? Math.max(1, Math.round(details.quantity)) : 1
  const parallel = inferChecklistOwnedParallel(item)
  const notes = String(details?.notes || '').trim()

  const titleParts = [year, setName, name, cardNumber ? `#${cardNumber}` : '']
    .map((part) => String(part || '').trim())
    .filter(Boolean)

  const descriptionParts = [
    insertSet ? `Insert Set: ${insertSet}` : '',
    notes ? `Notes: ${notes}` : ''
  ].filter(Boolean)

  return {
    Side: 'Single',
    SKU: String(details?.sku || '').trim(),
    Name: name,
    Team: team,
    Position: String(item?.position || '').trim(),
    Set: setName,
    Year: year,
    CardNumber: cardNumber,
    Quantity: quantity,
    Parallel: parallel,
    Rookie: String(details?.rookie || 'No').trim() || 'No',
    Autograph: String(details?.autograph || 'No').trim() || 'No',
    Title: titleParts.join(' '),
    Description: descriptionParts.join(' | '),
    PickFrom: '',
    Filename: '',
    PictureURL: ''
  }
}

async function saveChecklistOwnedCardToInventory(item = {}, details = {}) {
  const payload = {
    sport: activeSport(),
    cards: [buildInventoryCardFromChecklist(item, details)]
  }

  const res = await fetchBackend('/inventory/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await parseApiJsonResponse(res, 'Owned card save failed')
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to save owned card into inventory.')
  }

  markChecklistCardOwned(item)
  await refreshCommittedSkuCounterFromInventory()

  const name = String(item?.player || '').trim() || `Card #${String(item?.cardNumber || '').trim()}`
  showChecklistStatus(`Added ${name} to inventory (${data.inserted || 0} new, ${data.updated || 0} updated).`)
  showInventoryStatus(`Checklist card saved to ${activeSport()} inventory.`)
}

function requestChecklistOwnedCardDetails(item = {}) {
  if (!checklistOwnedCardModal) {
    return Promise.resolve({ confirmed: false, details: null })
  }

  pendingChecklistOwnedCardItem = item
  const titleBits = [
    String(activeChecklistSetMeta?.year || '').trim(),
    String(activeChecklistSetMeta?.brand || '').trim(),
    String(activeChecklistSetMeta?.setName || '').trim()
  ].filter(Boolean)
  const titleText = titleBits.join(' ')
  const cardLabel = `${String(item?.cardNumber || '').trim()} ${String(item?.player || '').trim()} ${String(item?.team || '').trim()}`.trim()

  if (checklistOwnedCardSummary) {
    checklistOwnedCardSummary.textContent = `${titleText} | ${cardLabel || 'Checklist card selected'}`
  }

  if (checklistOwnedSkuInput) checklistOwnedSkuInput.value = nextSku()
  if (checklistOwnedQuantityInput) checklistOwnedQuantityInput.value = '1'
  if (checklistOwnedParallelDisplay) {
    checklistOwnedParallelDisplay.textContent = `Parallel / Variant: ${inferChecklistOwnedParallel(item)} (auto-detected)`
  }
  if (checklistOwnedRookieSelect) checklistOwnedRookieSelect.value = isChecklistRowRookie(item) ? 'Yes' : 'No'
  if (checklistOwnedAutographSelect) checklistOwnedAutographSelect.value = 'No'
  if (checklistOwnedNotesInput) checklistOwnedNotesInput.value = ''

  checklistOwnedCardModal.classList.add('active')
  return new Promise((resolve) => {
    pendingChecklistOwnedCardResolve = resolve
  })
}

async function handleChecklistOwnedToggleChange(event) {
  const checkbox = event?.target
  if (!checkbox || !checkbox.classList?.contains('checklist-owned-checkbox')) return

  const rowIndex = Number(checkbox?.dataset?.rowIndex)
  if (!Number.isFinite(rowIndex) || rowIndex < 0) {
    checkbox.checked = false
    return
  }

  const item = checklistVisibleRowsCache[rowIndex]
  if (!item) {
    checkbox.checked = false
    return
  }

  if (!checkbox.checked) {
    checkbox.checked = isChecklistCardOwned(item)
    return
  }

  if (isChecklistCardOwned(item)) {
    showChecklistStatus('Card is already marked owned in this set.')
    checkbox.checked = true
    return
  }

  try {
    const decision = await requestChecklistOwnedCardDetails(item)
    if (!decision?.confirmed || !decision?.details) {
      checkbox.checked = false
      return
    }

    await saveChecklistOwnedCardToInventory(item, decision.details)
    renderChecklistTable(checklistCardsCache)
  } catch (err) {
    checkbox.checked = false
    showChecklistStatus(`Owned card save failed: ${err.message || 'Unknown error'}`, true)
  }
}

function renderChecklistTable(items = checklistCardsCache) {
  if (!checklistDataBody) return
  applySortHeaderState(checklistSortHeaders, checklistSortState)

  const rookieFiltered = applyChecklistRookieFilter(items)
  const customFiltered = applyChecklistCustomFilter(rookieFiltered)
  const sortedItems = sortChecklistItems(customFiltered)
  checklistVisibleRowsCache = sortedItems

  if (!sortedItems.length) {
    checklistDataBody.innerHTML = '<tr><td colspan="5">No checklist rows found for this set/filter.</td></tr>'
    return
  }

  checklistDataBody.innerHTML = ''
  sortedItems.forEach((item, index) => {
    const insertSet = checklistInsertSetLabel(item)
    const player = String(item?.player || '').trim()
    const playerWithRookie = player ? `${player}${isRookieFlag(item?.rookie) ? '*' : ''}` : ''
    const owned = isChecklistCardOwned(item)
    const row = document.createElement('tr')
    row.innerHTML = `
      <td>${item?.cardNumber || ''}</td>
      <td>${insertSet}</td>
      <td>${playerWithRookie}</td>
      <td>${item?.team || ''}</td>
      <td class="checklist-owned-cell">
        <label class="checklist-owned-toggle">
          <input type="checkbox" class="checklist-owned-checkbox" data-row-index="${index}" ${owned ? 'checked' : ''}>
          <span>${owned ? 'Owned' : 'Own'}</span>
        </label>
      </td>
    `
    checklistDataBody.appendChild(row)
  })
}

function renderOddsTable(items = checklistOddsCache) {
  if (!checklistOddsBody) return
  applySortHeaderState(oddsSortHeaders, oddsSortState)

  const sortedItems = sortOddsItems(items)
  if (!sortedItems.length) {
    checklistOddsBody.innerHTML = '<tr><td colspan="5">No odds rows found for this set/filter.</td></tr>'
    return
  }

  checklistOddsBody.innerHTML = ''
  sortedItems.forEach((item) => {
    const row = document.createElement('tr')
    row.innerHTML = `
      <td>${item?.category || ''}</td>
      <td>${item?.itemName || ''}</td>
      <td>${item?.oddsText || ''}</td>
      <td>${item?.packRate || ''}</td>
      <td>${item?.notes || ''}</td>
    `
    checklistOddsBody.appendChild(row)
  })
}

function checklistFilterParams() {
  const year = normalizeChecklistYear(checklistYearFilter?.value)
  const search = String(checklistSetSearchInput?.value || '').trim()
  return {
    year,
    search,
    sport: activeSport()
  }
}

function checklistDetailFilterParams() {
  return {
    setId: String(activeChecklistSetId || '').trim(),
    sport: activeSport(),
    year: normalizeChecklistYear(activeChecklistSetMeta?.year || checklistYearFilter?.value),
    search: String(checklistSearchInput?.value || '').trim(),
    category: String(checklistOddsCategoryFilter?.value || '').trim()
  }
}

function toQueryString(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    const clean = String(value || '').trim()
    if (!clean) return
    query.set(key, clean)
  })
  return query.toString()
}

async function loadChecklistCatalogData({ quiet = false } = {}) {
  if (!checklistPage) return

  const filters = checklistFilterParams()
  const setQuery = toQueryString({ sport: filters.sport, year: filters.year })

  if (!quiet) {
    showChecklistStatus('Loading imported sets...')
  }

  try {
    const setsRes = await fetchBackend(`/catalog/sets?${setQuery}`)
    const setsData = await setsRes.json()

    if (!setsRes.ok) throw new Error(setsData?.error || 'Failed to load set list')

    checklistSetsCache = Array.isArray(setsData?.items) ? setsData.items : []

    if (filters.search) {
      const token = filters.search.toLowerCase()
      checklistSetsCache = checklistSetsCache.filter((item) => {
        const haystack = `${item?.year || ''} ${item?.brand || ''} ${item?.setName || ''}`.toLowerCase()
        return haystack.includes(token)
      })
    }

    renderChecklistSetsTable(checklistSetsCache)
    showChecklistStatus(`Loaded ${checklistSetsCache.length} imported set(s).`)
  } catch (err) {
    renderChecklistSetsTable([])
    showChecklistStatus(`Checklist workspace load failed: ${err.message || 'Unknown error'}`, true)
  }
}

function openChecklistSetModal(setItem) {
  if (!setItem?.id || !checklistSetModal) return
  activeChecklistSetId = String(setItem.id)
  activeChecklistSetMeta = setItem
  hydrateChecklistOwnedKeysForActiveSet()
  if (checklistSetModalTitle) {
    checklistSetModalTitle.textContent = `${setItem.year || ''} ${setItem.brand || ''} ${setItem.setName || ''}`.trim() || 'Set Drill Down'
  }
  if (checklistSearchInput) checklistSearchInput.value = ''
  if (checklistOddsCategoryFilter) checklistOddsCategoryFilter.value = ''
  if (checklistRookieFilter) checklistRookieFilter.value = 'all'
  if (checklistCustomFilterField) checklistCustomFilterField.value = ''
  if (checklistCustomFilterOperator) checklistCustomFilterOperator.value = 'contains'
  if (checklistCustomFilterValue) checklistCustomFilterValue.value = ''
  syncChecklistSortControls()
  checklistSetModal.classList.add('active')
  setChecklistView('checklist')
  syncOwnedChecklistKeysFromInventoryForActiveSet().catch(() => {})
  loadChecklistSetDetail({ quiet: false }).catch(() => {})
}

function closeChecklistSetModal() {
  if (!checklistSetModal) return
  checklistSetModal.classList.remove('active')
  activeChecklistSetId = ''
  activeChecklistSetMeta = null
  checklistVisibleRowsCache = []
  checklistOwnedCardKeys = new Set()
}

async function loadChecklistSetDetail({ quiet = false } = {}) {
  if (!activeChecklistSetId) return
  const filters = checklistDetailFilterParams()
  const checklistQuery = toQueryString({
    setId: filters.setId,
    sport: filters.sport,
    year: filters.year,
    search: filters.search,
    limit: '4000'
  })
  const oddsQuery = toQueryString({
    setId: filters.setId,
    sport: filters.sport,
    year: filters.year,
    search: filters.search,
    category: filters.category,
    limit: '4000'
  })

  if (!quiet) {
    showChecklistStatus('Loading selected set details...')
  }

  try {
    const [checklistRes, oddsRes] = await Promise.all([
      fetchBackend(`/catalog/checklist?${checklistQuery}`),
      fetchBackend(`/catalog/odds?${oddsQuery}`)
    ])
    const [checklistData, oddsData] = await Promise.all([
      checklistRes.json(),
      oddsRes.json()
    ])

    if (!checklistRes.ok) throw new Error(checklistData?.error || 'Failed to load checklist rows')
    if (!oddsRes.ok) throw new Error(oddsData?.error || 'Failed to load odds rows')

    checklistCardsCache = Array.isArray(checklistData?.items) ? checklistData.items : []
    checklistOddsCache = Array.isArray(oddsData?.items) ? oddsData.items : []
    renderChecklistTable(checklistCardsCache)
    renderOddsTable(checklistOddsCache)
    showChecklistStatus(`Loaded ${checklistCardsCache.length} checklist row(s) and ${checklistOddsCache.length} odds row(s) for selected set.`)
  } catch (err) {
    renderChecklistTable([])
    renderOddsTable([])
    showChecklistStatus(`Set detail load failed: ${err.message || 'Unknown error'}`, true)
  }
}

function loadChecklistImportProfiles() {
  try {
    const raw = localStorage.getItem(CHECKLIST_IMPORT_PROFILE_STORAGE_KEY)
    const parsed = JSON.parse(String(raw || '[]'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveChecklistImportProfiles(profiles = []) {
  try {
    const items = Array.isArray(profiles) ? profiles : []
    localStorage.setItem(CHECKLIST_IMPORT_PROFILE_STORAGE_KEY, JSON.stringify(items.slice(0, 120)))
  } catch {
    // Ignore storage failures.
  }
}

function checklistImportProfileKey(profile = {}) {
  const sport = String(profile?.sport || '').trim().toLowerCase()
  const year = String(profile?.year || '').trim().toLowerCase()
  const manufacturer = String(profile?.manufacturer || '').trim().toLowerCase()
  const setName = String(profile?.setName || '').trim().toLowerCase()
  return `${sport}|${year}|${manufacturer}|${setName}`
}

function findChecklistImportProfileSuggestion(context = {}) {
  const profiles = loadChecklistImportProfiles()
  if (!profiles.length) return null

  const contextKey = checklistImportProfileKey({
    sport: context?.sport,
    year: context?.year,
    manufacturer: context?.manufacturer,
    setName: context?.setName
  })

  const exact = profiles.find((item) => checklistImportProfileKey(item) === contextKey)
  if (exact) return exact

  const sameSport = profiles.find((item) => String(item?.sport || '').trim().toLowerCase() === String(context?.sport || '').trim().toLowerCase())
  return sameSport || profiles[0]
}

function buildChecklistImportProfileNotes(profile = {}) {
  const customColumns = String(profile?.customColumns || '').trim()
  const notes = String(profile?.notes || '').trim()
  const pieces = []
  if (customColumns) pieces.push(`customColumns: ${customColumns}`)
  if (notes) pieces.push(`notes: ${notes}`)
  return pieces.join(' | ')
}

function applyChecklistImportProfileToForm(profile = {}) {
  if (checklistImportSetName) checklistImportSetName.value = String(profile?.setName || checklistImportSetName.value || '').trim()
  if (checklistImportYear && profile?.year) checklistImportYear.value = String(profile.year).trim()
  if (checklistImportBrand) checklistImportBrand.value = String(profile?.manufacturer || checklistImportBrand.value || '').trim()
}

function resolveChecklistImportProfileDialog(result) {
  if (typeof pendingChecklistImportProfileResolve === 'function') {
    const resolver = pendingChecklistImportProfileResolve
    pendingChecklistImportProfileResolve = null
    resolver(result)
  }
}

function closeChecklistImportProfileDialog(result = { confirmed: false, profile: null }) {
  if (checklistImportProfileModal) {
    checklistImportProfileModal.classList.remove('active')
  }
  pendingChecklistImportProfileContext = null
  resolveChecklistImportProfileDialog(result)
}

function collectChecklistImportProfileInput() {
  const context = pendingChecklistImportProfileContext || {}
  return {
    sport: String(context?.sport || activeSport() || '').trim(),
    setName: String(checklistImportProfileSetName?.value || '').trim(),
    year: String(checklistImportProfileYear?.value || '').trim(),
    manufacturer: String(checklistImportProfileManufacturer?.value || '').trim(),
    customColumns: String(checklistImportProfileCustomColumns?.value || '').trim(),
    notes: String(checklistImportProfileNotes?.value || '').trim(),
    sourceType: String(context?.sourceType || '').trim(),
    sourceUrl: String(context?.sourceUrl || '').trim(),
    createdAt: new Date().toISOString()
  }
}

function saveChecklistImportProfile(profile = {}) {
  const profiles = loadChecklistImportProfiles()
  const key = checklistImportProfileKey(profile)
  const filtered = profiles.filter((item) => checklistImportProfileKey(item) !== key)
  filtered.unshift(profile)
  saveChecklistImportProfiles(filtered)
}

async function requestChecklistImportProfile(context = {}) {
  if (!checklistImportProfileModal) {
    return { confirmed: true, profile: null }
  }

  const normalizedContext = {
    sport: String(context?.sport || activeSport() || '').trim(),
    setName: String(context?.setName || checklistImportSetName?.value || '').trim(),
    year: String(context?.year || checklistImportYear?.value || '').trim(),
    manufacturer: String(context?.manufacturer || checklistImportBrand?.value || '').trim(),
    sourceType: String(context?.sourceType || '').trim(),
    sourceUrl: String(context?.sourceUrl || '').trim()
  }
  pendingChecklistImportProfileContext = normalizedContext

  const suggestion = findChecklistImportProfileSuggestion(normalizedContext)
  const merged = {
    ...suggestion,
    ...normalizedContext,
    setName: normalizedContext.setName || String(suggestion?.setName || '').trim(),
    year: normalizedContext.year || String(suggestion?.year || '').trim(),
    manufacturer: normalizedContext.manufacturer || String(suggestion?.manufacturer || '').trim()
  }

  if (checklistImportProfileSummary) {
    checklistImportProfileSummary.textContent = `Review metadata before ingesting ${normalizedContext.sourceType || 'checklist'} data. These values improve downstream parsing, inventory, and listing templates.`
  }
  if (checklistImportProfileSetName) checklistImportProfileSetName.value = merged.setName || ''
  if (checklistImportProfileYear) checklistImportProfileYear.value = merged.year || ''
  if (checklistImportProfileManufacturer) checklistImportProfileManufacturer.value = merged.manufacturer || ''
  if (checklistImportProfileCustomColumns) checklistImportProfileCustomColumns.value = String(suggestion?.customColumns || '').trim()
  if (checklistImportProfileNotes) checklistImportProfileNotes.value = String(suggestion?.notes || '').trim()

  checklistImportProfileModal.classList.add('active')

  return new Promise((resolve) => {
    pendingChecklistImportProfileResolve = resolve
  })
}

async function ensureChecklistImportProfileBeforeIngest(context = {}) {
  const decision = await requestChecklistImportProfile(context)
  if (!decision?.confirmed) {
    showChecklistStatus('Import cancelled. Import profile not confirmed.', true)
    return null
  }

  const profile = decision?.profile || null
  if (profile) {
    applyChecklistImportProfileToForm(profile)
  }
  return profile
}

async function importChecklistRows() {
  try {
    const profile = await ensureChecklistImportProfileBeforeIngest({
      sourceType: selectedChecklistFile ? 'checklist file' : 'checklist text/paste',
      sport: activeSport(),
      year: checklistImportYear?.value,
      setName: checklistImportSetName?.value,
      manufacturer: checklistImportBrand?.value
    })
    if (profile === null) return

    const set = validateChecklistSetForm()
    const profileNotes = buildChecklistImportProfileNotes(profile || {})
    if (profileNotes) set.notes = profileNotes
    if (selectedChecklistFile) {
      showChecklistStatus(`Importing checklist file: ${selectedChecklistFile.name}...`)
      const fileResult = await importChecklistFromSelectedFile(set)
      showChecklistStatus(`Checklist import complete: ${fileResult?.inserted || 0} inserted, ${fileResult?.updated || 0} updated.`)
      await loadChecklistCatalogData({ quiet: true })
      return
    }

    const cards = await parseChecklistImportPayload()
    if (!cards.length) {
      throw new Error('No checklist rows found in the selected file, URL, or pasted text.')
    }
    showChecklistStatus(`Importing ${cards.length} checklist row(s)...`)
    const res = await fetchBackend('/catalog/checklist/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ set, cards })
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error || 'Checklist import failed')
    }

    showChecklistStatus(`Checklist import complete: ${data.inserted || 0} inserted, ${data.updated || 0} updated.`)
    await loadChecklistCatalogData({ quiet: true })
  } catch (err) {
    showChecklistStatus(`Checklist import failed: ${err.message || 'Unknown error'}`, true)
  }
}

async function importOddsRows() {
  try {
    const profile = await ensureChecklistImportProfileBeforeIngest({
      sourceType: selectedOddsFile ? 'odds file' : 'odds text/paste',
      sport: activeSport(),
      year: checklistImportYear?.value,
      setName: checklistImportSetName?.value,
      manufacturer: checklistImportBrand?.value
    })
    if (profile === null) return

    const set = validateChecklistSetForm()
    const profileNotes = buildChecklistImportProfileNotes(profile || {})
    if (profileNotes) set.notes = profileNotes
    if (selectedOddsFile) {
      showChecklistStatus(`Importing odds file: ${selectedOddsFile.name}...`)
      const fileResult = await importOddsFromSelectedFile(set)
      showChecklistStatus(`Odds import complete: ${fileResult?.inserted || 0} inserted, ${fileResult?.updated || 0} updated.`)
      await loadChecklistCatalogData({ quiet: true })
      return
    }

    const odds = await parseOddsImportPayload()
    if (!odds.length) {
      throw new Error('No odds rows found in the selected file, URL, or pasted text.')
    }
    showChecklistStatus(`Importing ${odds.length} odds row(s)...`)
    const res = await fetchBackend('/catalog/odds/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ set, odds })
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error || 'Odds import failed')
    }

    showChecklistStatus(`Odds import complete: ${data.inserted || 0} inserted, ${data.updated || 0} updated.`)
    await loadChecklistCatalogData({ quiet: true })
  } catch (err) {
    showChecklistStatus(`Odds import failed: ${err.message || 'Unknown error'}`, true)
  }
}

function cloneProviderCatalog() {
  const providers = Array.isArray(authState?.providers) && authState.providers.length
    ? authState.providers
    : DEFAULT_CONNECTION_PROVIDERS
  return providers.map((provider) => ({ ...provider }))
}

function syncGoogleAuthButtons() {
  const supportsGoogle = cloneProviderCatalog().some((provider) => String(provider?.key || '').toLowerCase() === 'google')

  if (googleLoginBtn) {
    googleLoginBtn.style.display = supportsGoogle ? '' : 'none'
    googleLoginBtn.disabled = !supportsGoogle
    if (!supportsGoogle) {
      googleLoginBtn.setAttribute('title', 'Google sign-in is not enabled in this environment.')
    } else {
      googleLoginBtn.removeAttribute('title')
    }
  }

  if (googleLinkBtn) {
    googleLinkBtn.style.display = supportsGoogle ? '' : 'none'
    googleLinkBtn.disabled = !supportsGoogle
  }
}

function getStoredAuthToken() {
  let tokenFromSession = ''
  let tokenFromLocal = ''

  try {
    tokenFromSession = String(sessionStorage.getItem(AUTH_SESSION_TOKEN_KEY) || '').trim()
  } catch {
    tokenFromSession = ''
  }

  try {
    tokenFromLocal = String(localStorage.getItem(AUTH_TOKEN_KEY) || '').trim()
  } catch {
    tokenFromLocal = ''
  }

  if (tokenFromSession) {
    rememberMeEnabled = false
    if (rememberMeCheckbox) rememberMeCheckbox.checked = false
    return tokenFromSession
  }

  if (tokenFromLocal) {
    rememberMeEnabled = true
    if (rememberMeCheckbox) rememberMeCheckbox.checked = true
    return tokenFromLocal
  }

  rememberMeEnabled = false
  if (rememberMeCheckbox) rememberMeCheckbox.checked = false
  return ''
}

function persistAuthToken(token, options = {}) {
  authToken = String(token || '').trim()
  const rememberMe = typeof options?.rememberMe === 'boolean'
    ? options.rememberMe
    : Boolean(rememberMeEnabled)
  rememberMeEnabled = rememberMe

  try {
    if (!authToken) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      localStorage.removeItem(AUTH_REMEMBER_KEY)
      sessionStorage.removeItem(AUTH_SESSION_TOKEN_KEY)
      if (rememberMeCheckbox) rememberMeCheckbox.checked = false
      return
    }

    if (rememberMe) {
      localStorage.setItem(AUTH_TOKEN_KEY, authToken)
      localStorage.setItem(AUTH_REMEMBER_KEY, 'true')
      sessionStorage.removeItem(AUTH_SESSION_TOKEN_KEY)
    } else {
      sessionStorage.setItem(AUTH_SESSION_TOKEN_KEY, authToken)
      localStorage.removeItem(AUTH_TOKEN_KEY)
      localStorage.setItem(AUTH_REMEMBER_KEY, 'false')
    }

    if (rememberMeCheckbox) rememberMeCheckbox.checked = rememberMe
  } catch {
    // Ignore storage errors.
  }
}

function applyAuthLandingMode() {
  const isAuthed = isUserAuthenticated()
  document.body.classList.toggle('auth-landing-mode', !isAuthed)

  if (appHeader) appHeader.style.display = isAuthed ? '' : 'none'
  if (appNav) appNav.style.display = isAuthed ? '' : 'none'
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatProfileDate(value) {
  const parsed = Date.parse(String(value || ''))
  if (!Number.isFinite(parsed)) return 'Unknown'
  return new Date(parsed).toLocaleString()
}

function showProfileStatus(message, isError = false) {
  const nextMessage = message || ''
  if (profileHeroStatus) {
    profileHeroStatus.textContent = nextMessage
    profileHeroStatus.style.background = isError ? '#ffe7e7' : '#eef3ff'
    profileHeroStatus.style.color = isError ? '#8a1f1f' : '#30427a'
  }

  if (profileAuthStatus) {
    profileAuthStatus.textContent = nextMessage
    profileAuthStatus.classList.toggle('error', Boolean(isError))
  }
}

function setAuthPortalView(view) {
  const safeView = String(view || 'login').trim().toLowerCase()
  const nextView = ['login', 'signup', 'reset'].includes(safeView) ? safeView : 'login'

  if (authLoginPortal) authLoginPortal.classList.toggle('active', nextView === 'login')
  if (authSignupPortal) authSignupPortal.classList.toggle('active', nextView === 'signup')
  if (authResetPortal) authResetPortal.classList.toggle('active', nextView === 'reset')

  if (authPortalTitle) {
    authPortalTitle.textContent = nextView === 'signup'
      ? 'Create your account'
      : nextView === 'reset'
        ? 'Reset password'
        : 'Sign in'
  }

  if (authPortalSubtitle) {
    authPortalSubtitle.textContent = nextView === 'signup'
      ? 'Register once, then use the same credentials in this environment.'
      : nextView === 'reset'
        ? 'Enter your account details to set a new password.'
        : 'Use your email and password to access CardPilot HQ.'
  }
}

function getConnectionBySlug(providerSlug) {
  const connections = Array.isArray(authState?.connections) ? authState.connections : []
  return connections.find((connection) => String(connection?.providerSlug || connection?.provider || '') === String(providerSlug || '')) || null
}

function getProviderTemplate(providerKey) {
  return cloneProviderCatalog().find((provider) => provider.key === providerKey) || null
}

function currentConnectionFormSlug() {
  const providerKey = String(profileConnectionProviderSelect?.value || '').trim().toLowerCase()
  if (providerKey !== 'other') return providerKey
  const customName = String(profileCustomProviderInput?.value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `other:${customName || 'custom'}`
}

function updateAccountButtonLabel() {
  if (!accountProfileBtn) return
  const name = String(authState?.user?.displayName || authState?.user?.email || '').trim()
  accountProfileBtn.textContent = name ? `Profile: ${name}` : 'Sign In'
}

function populateConnectionProviderOptions(selectedKey = '') {
  if (!profileConnectionProviderSelect) return
  const providers = cloneProviderCatalog()
  const targetKey = selectedKey || String(profileConnectionProviderSelect.value || providers[0]?.key || 'ebay')
  profileConnectionProviderSelect.innerHTML = ''
  providers.forEach((provider) => {
    const option = document.createElement('option')
    option.value = provider.key
    option.textContent = provider.label
    profileConnectionProviderSelect.appendChild(option)
  })
  profileConnectionProviderSelect.value = providers.some((provider) => provider.key === targetKey)
    ? targetKey
    : (providers[0]?.key || 'ebay')
}

function populateConnectionAuthTypeOptions() {
  if (!profileConnectionAuthTypeSelect) return
  const providerKey = String(profileConnectionProviderSelect?.value || '').trim().toLowerCase()
  const template = getProviderTemplate(providerKey)
  const authTypes = Array.isArray(template?.authTypes) && template.authTypes.length
    ? template.authTypes
    : ['manual']
  const currentValue = String(profileConnectionAuthTypeSelect.value || '').trim().toLowerCase()
  profileConnectionAuthTypeSelect.innerHTML = ''
  authTypes.forEach((authType) => {
    const option = document.createElement('option')
    option.value = authType
    option.textContent = authType.replace(/-/g, ' ')
    profileConnectionAuthTypeSelect.appendChild(option)
  })
  profileConnectionAuthTypeSelect.value = authTypes.includes(currentValue) ? currentValue : authTypes[0]
}

function toggleCustomProviderRow() {
  const isOther = String(profileConnectionProviderSelect?.value || '').trim().toLowerCase() === 'other'
  if (profileCustomProviderRow) {
    profileCustomProviderRow.style.display = isOther ? 'flex' : 'none'
  }
}

function resetConnectionForm(providerKey = '') {
  editingConnectionProviderSlug = ''
  populateConnectionProviderOptions(providerKey || 'ebay')
  toggleCustomProviderRow()
  populateConnectionAuthTypeOptions()
  if (profileCustomProviderInput) profileCustomProviderInput.value = ''
  if (profileConnectionCapabilitySelect) profileConnectionCapabilitySelect.value = 'research'
  if (profileConnectionStatusSelect) profileConnectionStatusSelect.value = 'planned'
  if (profileConnectionAccountLabelInput) profileConnectionAccountLabelInput.value = ''
  if (profileConnectionNotesInput) profileConnectionNotesInput.value = ''
}

function loadConnectionIntoForm(providerSlug) {
  const connection = getConnectionBySlug(providerSlug)
  if (!connection) {
    resetConnectionForm(String(providerSlug || '').split(':')[0] || 'ebay')
    return
  }

  editingConnectionProviderSlug = String(connection.providerSlug || connection.provider || '')
  populateConnectionProviderOptions(connection.provider)
  toggleCustomProviderRow()
  if (profileCustomProviderInput) profileCustomProviderInput.value = connection.customProviderName || ''
  populateConnectionAuthTypeOptions()
  if (profileConnectionCapabilitySelect) profileConnectionCapabilitySelect.value = connection.capability || 'research'
  if (profileConnectionStatusSelect) profileConnectionStatusSelect.value = connection.status || 'planned'
  if (profileConnectionAuthTypeSelect) profileConnectionAuthTypeSelect.value = connection.authType || profileConnectionAuthTypeSelect.value
  if (profileConnectionAccountLabelInput) profileConnectionAccountLabelInput.value = connection.accountLabel || ''
  if (profileConnectionNotesInput) profileConnectionNotesInput.value = connection.notes || ''
}

function renderConnectionsList() {
  if (!profileConnectionsList) return

  const providers = cloneProviderCatalog().filter((provider) => provider.key !== 'other')
  const connectionItems = []

  providers.forEach((provider) => {
    const connection = getConnectionBySlug(provider.key)
    connectionItems.push({
      providerKey: provider.key,
      providerSlug: provider.key,
      label: provider.label,
      notes: provider.notes,
      supportsDirectAuth: provider.supportsDirectAuth,
      authTypes: provider.authTypes,
      connection
    })
  })

  const customConnections = (Array.isArray(authState?.connections) ? authState.connections : [])
    .filter((connection) => connection.provider === 'other')
    .sort((left, right) => String(left.providerLabel || '').localeCompare(String(right.providerLabel || '')))

  customConnections.forEach((connection) => {
    connectionItems.push({
      providerKey: 'other',
      providerSlug: connection.providerSlug,
      label: connection.providerLabel || connection.customProviderName || 'Custom Provider',
      notes: 'Custom provider record for additional marketplaces or research systems.',
      supportsDirectAuth: false,
      authTypes: ['oauth', 'api-key', 'manual', 'cookie-session'],
      connection
    })
  })

  profileConnectionsList.innerHTML = connectionItems.map((item) => {
    const status = item.connection?.status || 'not connected'
    const capability = item.connection?.capability || (item.providerKey === 'ebay' ? 'research+listings' : 'research')
    const authType = item.connection?.authType || item.authTypes[0] || 'manual'
    const buttonLabel = item.connection ? 'Edit' : 'Set Up'
    const accountLabel = item.connection?.accountLabel ? `<p><strong>Account:</strong> ${escapeHtml(item.connection.accountLabel)}</p>` : ''
    const noteText = item.connection?.notes || item.notes || ''
    const oauthConnected = Boolean(item.connection?.metadata?.oauthConnected)
    const oauthExpiresAt = item.connection?.metadata?.oauthExpiresAt
      ? `<p><strong>OAuth Expires:</strong> ${escapeHtml(formatProfileDate(item.connection.metadata.oauthExpiresAt))}</p>`
      : ''
    const directAction = item.providerKey === 'ebay'
      ? `<button type="button" class="primary-btn" data-provider-oauth="ebay">${oauthConnected ? 'Reconnect eBay OAuth' : 'Connect eBay OAuth'}</button>
         <button type="button" class="secondary-btn" data-provider-oauth-manual="ebay">Finish OAuth From URL</button>`
      : ''
    return `
      <article class="profile-connection-item">
        <h4>${escapeHtml(item.label)}</h4>
        <div class="profile-connection-meta">
          <span class="profile-connection-chip">${escapeHtml(status)}</span>
          <span class="profile-connection-chip">${escapeHtml(capability)}</span>
          <span class="profile-connection-chip">${escapeHtml(authType)}</span>
          ${oauthConnected ? '<span class="profile-connection-chip">oauth live</span>' : ''}
        </div>
        ${accountLabel}
        ${oauthExpiresAt}
        <p>${escapeHtml(noteText)}</p>
        <div class="profile-connection-actions">
          ${directAction}
          <button type="button" data-provider-slug="${escapeHtml(item.providerSlug)}">${buttonLabel}</button>
        </div>
      </article>
    `
  }).join('')

  profileConnectionsList.querySelectorAll('button[data-provider-slug]').forEach((button) => {
    button.addEventListener('click', () => {
      loadConnectionIntoForm(button.getAttribute('data-provider-slug') || '')
      showProfileStatus(`Editing ${button.closest('.profile-connection-item')?.querySelector('h4')?.textContent || 'connection'}.`)
    })
  })

  profileConnectionsList.querySelectorAll('button[data-provider-oauth="ebay"]').forEach((button) => {
    button.addEventListener('click', beginEbayOAuthFlow)
  })

  profileConnectionsList.querySelectorAll('button[data-provider-oauth-manual="ebay"]').forEach((button) => {
    button.addEventListener('click', completeEbayOAuthFromUrl)
  })
}

function extractEbayOAuthCallbackParams(rawUrl) {
  const text = String(rawUrl || '').trim()
  if (!text) return null

  try {
    const parsed = new URL(text)
    const state = String(parsed.searchParams.get('state') || '').trim()
    const code = String(parsed.searchParams.get('code') || '').trim()
    if (!state || !code) return null
    return { state, code }
  } catch {
    return null
  }
}

function completeEbayOAuthFromUrl() {
  if (!authState?.user) {
    showProfileStatus('Sign in first to complete eBay OAuth.', true)
    return
  }

  const pasted = window.prompt('Paste the full eBay success URL containing state and code:')
  if (!pasted) return

  const params = extractEbayOAuthCallbackParams(pasted)
  if (!params?.state || !params?.code) {
    showProfileStatus('Could not find state/code in that URL. Copy the full address bar URL from the eBay success page.', true)
    return
  }

  showProfileStatus('Finishing eBay OAuth with returned state/code...')
  const callbackUrl = `/auth/ebay/callback?state=${encodeURIComponent(params.state)}&code=${encodeURIComponent(params.code)}`

  getBackendUrl()
    .then((backendUrl) => {
      window.location.assign(`${backendUrl}${callbackUrl}`)
    })
    .catch((err) => {
      showProfileStatus(`Could not resolve backend URL for OAuth completion: ${err?.message || 'Unknown error'}`, true)
    })
}

function renderProfileUi() {
  updateAccountButtonLabel()
  applyAuthLandingMode()
  syncGoogleAuthButtons()
  populateConnectionProviderOptions(String(profileConnectionProviderSelect?.value || 'ebay'))
  toggleCustomProviderRow()
  populateConnectionAuthTypeOptions()

  const isLoggedIn = Boolean(authState?.user)
  if (profileAuthPanel) profileAuthPanel.style.display = isLoggedIn ? 'none' : 'block'
  if (profileWorkspace) profileWorkspace.style.display = isLoggedIn ? 'grid' : 'none'

  if (!isLoggedIn) {
    setAuthPortalView('login')
    if (rememberMeSignupCheckbox && rememberMeCheckbox) {
      rememberMeSignupCheckbox.checked = Boolean(rememberMeCheckbox.checked)
    }
    renderConnectionsList()
    showProfileStatus('Create a CardPilot HQ account or sign in before accessing Home and workspace tools.')
    return
  }

  if (profileAccountSummary) {
    profileAccountSummary.innerHTML = `
      <div><strong>Email:</strong> ${escapeHtml(authState.user.email || '')}</div>
      <div><strong>Member Since:</strong> ${escapeHtml(formatProfileDate(authState.user.createdAt))}</div>
      <div><strong>Last Login:</strong> ${escapeHtml(formatProfileDate(authState.user.lastLoginAt || authState.session?.createdAt))}</div>
      <div><strong>Session Expires:</strong> ${escapeHtml(formatProfileDate(authState.session?.expiresAt))}</div>
    `
  }

  if (profileDisplayNameInput) {
    profileDisplayNameInput.value = authState.user.displayName || ''
  }

  renderConnectionsList()
  if (!editingConnectionProviderSlug) {
    resetConnectionForm('ebay')
  }

  showProfileStatus(`Signed in as ${authState.user.displayName || authState.user.email}.`)
}

async function fetchBackend(endpoint, options = {}) {
  const backendUrl = await getBackendUrl()
  const headers = new Headers(options.headers || {})
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }

  return fetch(`${backendUrl}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers
  })
}

async function authApiFetch(endpoint, options = {}, { allowUnauthorized = false } = {}) {
  const backendUrl = await getBackendUrl()
  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }

  const response = await fetch(`${backendUrl}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (response.status === 401 && !allowUnauthorized) {
    persistAuthToken('')
    authState = {
      user: null,
      session: null,
      connections: [],
      providers: cloneProviderCatalog()
    }
    renderProfileUi()
  }

  return { response, data }
}

function applyAuthPayload(data, options = {}) {
  if (data?.token) {
    persistAuthToken(data.token, { rememberMe: options?.rememberMe })
  }

  authState = {
    user: data?.user || null,
    session: data?.session || (data?.expiresAt ? { expiresAt: data.expiresAt } : null),
    connections: Array.isArray(data?.connections) ? data.connections : [],
    providers: Array.isArray(data?.providers) && data.providers.length
      ? data.providers
      : cloneProviderCatalog()
  }
  editingConnectionProviderSlug = ''
  renderProfileUi()
}

async function ensureAuthProviders() {
  try {
    const { response, data } = await authApiFetch('/auth/providers', { method: 'GET' }, { allowUnauthorized: true })
    if (response.ok && Array.isArray(data?.providers) && data.providers.length) {
      authState.providers = data.providers
      syncGoogleAuthButtons()
      if (!authState.user) renderProfileUi()
    }
  } catch (err) {
    console.warn('Could not load auth provider catalog', err)
    syncGoogleAuthButtons()
  }
}

async function loadCurrentUserSession({ quiet = false } = {}) {
  authToken = getStoredAuthToken()

  try {
    const { response, data } = await authApiFetch('/auth/me', { method: 'GET' }, { allowUnauthorized: true })
    if (!response.ok || !data?.user) {
      persistAuthToken('')
      authState = {
        user: null,
        session: null,
        connections: [],
        providers: cloneProviderCatalog()
      }
      renderProfileUi()
      if (!quiet) showProfileStatus('Your session expired. Sign in again to manage your profile.', true)
      return false
    }

    applyAuthPayload(data)
    applyOAuthReturnContext()
    return true
  } catch (err) {
    if (!quiet) showProfileStatus(`Could not load your profile: ${err.message || 'Unknown error'}`, true)
    return false
  }
}

async function submitSignup() {
  try {
    showProfileStatus('Creating your CardPilot HQ account...')
    const rememberMe = Boolean(rememberMeSignupCheckbox?.checked ?? rememberMeCheckbox?.checked)
    const payload = {
      displayName: signupDisplayNameInput?.value || '',
      email: signupEmailInput?.value || '',
      password: signupPasswordInput?.value || '',
      rememberMe
    }
    const { response, data } = await authApiFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, { allowUnauthorized: true })

    if (!response.ok) {
      throw new Error(data?.error || 'Could not create account.')
    }

    if (signupPasswordInput) signupPasswordInput.value = ''
    if (loginPasswordInput) loginPasswordInput.value = ''
    applyAuthPayload(data, { rememberMe })
    setActivePage('home')
  } catch (err) {
    showProfileStatus(err.message || 'Could not create account.', true)
  }
}

async function submitLogin() {
  try {
    showProfileStatus('Signing in...')
    const rememberMe = Boolean(rememberMeCheckbox?.checked)
    const payload = {
      email: loginEmailInput?.value || '',
      password: loginPasswordInput?.value || '',
      rememberMe
    }
    const { response, data } = await authApiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, { allowUnauthorized: true })

    if (!response.ok) {
      throw new Error(data?.error || 'Could not sign in.')
    }

    if (loginPasswordInput) loginPasswordInput.value = ''
    if (signupPasswordInput) signupPasswordInput.value = ''
    applyAuthPayload(data, { rememberMe })
    setActivePage('home')
  } catch (err) {
    showProfileStatus(err.message || 'Could not sign in.', true)
  }
}

async function findAccountForSignin() {
  try {
    const identifier = String(recoveryIdentifierInput?.value || '').trim()
    if (!identifier) {
      showProfileStatus('Enter your email or display name to find your account.', true)
      return
    }

    showProfileStatus('Checking account details...')
    const { response, data } = await authApiFetch('/auth/recovery/find-account', {
      method: 'POST',
      body: JSON.stringify({ identifier })
    }, { allowUnauthorized: true })

    if (!response.ok) {
      throw new Error(data?.error || 'Could not check account details.')
    }

    if (!data?.found) {
      showProfileStatus('No account matched that email/display name. Try another identifier or create an account.', true)
      return
    }

    showProfileStatus(`Account found for ${data.emailHint || 'that user'}. Use that email to sign in or reset password.`)
    if (loginEmailInput && data?.emailHint) {
      // Keep the typed value if user entered a full email in lookup.
      if (identifier.includes('@')) loginEmailInput.value = identifier
    }
  } catch (err) {
    showProfileStatus(err.message || 'Could not check account details.', true)
  }
}

async function resetPasswordForSignin() {
  try {
    const email = String(recoveryEmailInput?.value || '').trim()
    const displayName = String(recoveryDisplayNameInput?.value || '').trim()
    const newPassword = String(recoveryNewPasswordInput?.value || '')

    if (!email || !displayName || !newPassword) {
      showProfileStatus('Email, display name, and new password are required for password reset.', true)
      return
    }

    showProfileStatus('Resetting password...')
    const { response, data } = await authApiFetch('/auth/recovery/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, displayName, newPassword })
    }, { allowUnauthorized: true })

    if (!response.ok) {
      throw new Error(data?.error || 'Could not reset password.')
    }

    if (loginEmailInput) loginEmailInput.value = email
    if (loginPasswordInput) loginPasswordInput.value = ''
    if (recoveryNewPasswordInput) recoveryNewPasswordInput.value = ''
    showProfileStatus(data?.message || 'Password reset successfully. Sign in with your new password.')
  } catch (err) {
    showProfileStatus(err.message || 'Could not reset password.', true)
  }
}

async function saveProfileSettings() {
  if (!authState?.user) {
    showProfileStatus('Sign in first to update your profile.', true)
    return
  }

  try {
    showProfileStatus('Saving profile changes...')
    const { response, data } = await authApiFetch('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ displayName: profileDisplayNameInput?.value || '' })
    })
    if (!response.ok) {
      throw new Error(data?.error || 'Could not save profile.')
    }
    applyAuthPayload({ ...authState, ...data })
    showProfileStatus('Profile saved.')
  } catch (err) {
    showProfileStatus(err.message || 'Could not save profile.', true)
  }
}

async function saveConnectionSettings() {
  if (!authState?.user) {
    showProfileStatus('Sign in first to manage connections.', true)
    return
  }

  const providerKey = String(profileConnectionProviderSelect?.value || '').trim().toLowerCase()
  const customProviderName = String(profileCustomProviderInput?.value || '').trim()

  if (providerKey === 'other' && !customProviderName) {
    showProfileStatus('Custom provider name is required for Other connections.', true)
    return
  }

  try {
    showProfileStatus('Saving connection...')
    const payload = {
      customProviderName,
      capability: profileConnectionCapabilitySelect?.value || 'research',
      status: profileConnectionStatusSelect?.value || 'planned',
      authType: profileConnectionAuthTypeSelect?.value || 'manual',
      accountLabel: profileConnectionAccountLabelInput?.value || '',
      notes: profileConnectionNotesInput?.value || '',
      metadata: {
        directAuthReady: Boolean(getProviderTemplate(providerKey)?.supportsDirectAuth)
      }
    }
    const { response, data } = await authApiFetch(`/auth/connections/${encodeURIComponent(providerKey)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      throw new Error(data?.error || 'Could not save connection.')
    }

    authState = {
      ...authState,
      connections: Array.isArray(data?.connections) ? data.connections : authState.connections
    }
    editingConnectionProviderSlug = String(data?.connection?.providerSlug || '')
    renderProfileUi()
    if (editingConnectionProviderSlug) loadConnectionIntoForm(editingConnectionProviderSlug)
    showProfileStatus('Connection saved.')
  } catch (err) {
    showProfileStatus(err.message || 'Could not save connection.', true)
  }
}

async function beginEbayOAuthFlow() {
  if (!authState?.user) {
    showProfileStatus('Sign in first to connect your eBay account.', true)
    return
  }

  try {
    showProfileStatus('Preparing eBay OAuth...')
    const returnPath = '/?page=profile'
    const { response, data } = await authApiFetch(`/auth/ebay/start?returnPath=${encodeURIComponent(returnPath)}`, {
      method: 'GET'
    })

    if (!response.ok || !data?.authUrl) {
      const missing = Array.isArray(data?.missing) && data.missing.length
        ? ` Missing: ${data.missing.join(', ')}`
        : ''
      throw new Error((data?.error || 'Could not start eBay OAuth.') + missing)
    }

    window.location.assign(data.authUrl)
  } catch (err) {
    showProfileStatus(err.message || 'Could not start eBay OAuth.', true)
  }
}

async function startGoogleOAuth(mode = 'login') {
  const safeMode = String(mode || 'login').trim().toLowerCase() === 'link' ? 'link' : 'login'

  if (safeMode === 'link' && !authState?.user) {
    showProfileStatus('Sign in first to link your Google account.', true)
    return
  }

  try {
    showProfileStatus(safeMode === 'link' ? 'Starting Google account linking...' : 'Starting Google sign-in...')
    const returnPath = safeMode === 'link' ? '/?page=profile' : '/?page=home'
    const { response, data } = await authApiFetch(
      `/auth/google/start?mode=${encodeURIComponent(safeMode)}&returnPath=${encodeURIComponent(returnPath)}`,
      { method: 'GET' },
      { allowUnauthorized: safeMode === 'login' }
    )

    if (!response.ok || !data?.authUrl) {
      const missing = Array.isArray(data?.missing) && data.missing.length
        ? ` Missing: ${data.missing.join(', ')}`
        : ''
      throw new Error((data?.error || 'Could not start Google OAuth.') + missing)
    }

    window.location.assign(data.authUrl)
  } catch (err) {
    showProfileStatus(err.message || 'Could not start Google OAuth.', true)
  }
}

async function logoutCurrentUser() {
  try {
    if (authToken) {
      await authApiFetch('/auth/logout', { method: 'POST' }, { allowUnauthorized: true })
    }
  } catch (err) {
    console.warn('Logout request failed', err)
  }

  persistAuthToken('', { rememberMe: false })
  authState = {
    user: null,
    session: null,
    connections: [],
    providers: cloneProviderCatalog()
  }
  resetConnectionForm('ebay')
  renderProfileUi()
  showProfileStatus('Signed out.')
}

function getListingUiControls() {
  const listingsActive = Boolean(listingsPage?.classList.contains('active'))
  return {
    templateSelect: listingsActive ? listingsListingTemplateSelect : listingTemplateSelect,
    cardIdInput: listingsActive ? listingsListingCardIdInput : listingCardIdInput,
    chaseCardInput: listingsActive ? listingsListingChaseCardIdInput : listingChaseCardIdInput,
    draftOutput: listingsActive ? listingsListingDraftOutput : listingDraftOutput,
    statusOutput: listingsActive ? listingStatus : inventoryStatus
  }
}

function hasStaleInventoryHint(value) {
  return /pick\s+from\s+\d+\s+cards?\s+in\s+inventory/i.test(String(value || ''))
}

function cleanStaleInventoryHint(value) {
  return hasStaleInventoryHint(value) ? '' : String(value || '')
}

function scrubScanPickFromValues() {
  for (const row of tableBody.querySelectorAll('tr')) {
    const pickFromSelect = row.querySelector('.pickFrom')
    if (!pickFromSelect) continue
    if (hasStaleInventoryHint(pickFromSelect.value)) {
      pickFromSelect.value = ''
    }
  }
}

function parsePriceNumber(value) {
  const raw = String(value ?? '').replace(/[^0-9.-]+/g, '').trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function normalizeComparable(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function buildPricingFingerprint(item) {
  return [
    normalizeComparable(item?.sport),
    normalizeComparable(item?.name),
    normalizeComparable(item?.team),
    normalizeComparable(item?.set),
    normalizeComparable(item?.year),
    normalizeComparable(item?.cardNumber),
    normalizeComparable(item?.parallel)
  ].join('|')
}

function aggregatePricingItems(items = []) {
  const grouped = new Map()
  const allItems = Array.isArray(items) ? items : []

  allItems.forEach((item) => {
    const key = buildPricingFingerprint(item)
    if (!key) return

    const qty = Number(item?.quantity || 1)
    const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1

    if (!grouped.has(key)) {
      grouped.set(key, {
        ...item,
        quantity: safeQty,
        pricingKey: key
      })
      return
    }

    const existing = grouped.get(key)
    existing.quantity = (Number(existing.quantity || 1) || 1) + safeQty
    if (!existing.id && item?.id) existing.id = item.id
    if (!existing.sku && item?.sku) existing.sku = item.sku
    if (!existing.updatedAt && item?.updatedAt) existing.updatedAt = item.updatedAt
  })

  return [...grouped.values()]
}

function formatCurrency(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `$${n.toFixed(2)}`
}

function summarizeCompPrices(values = []) {
  const prices = (Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)

  if (!prices.length) {
    return { count: 0, median: null, avg: null, min: null, max: null }
  }

  const mid = Math.floor(prices.length / 2)
  const median = prices.length % 2 === 0
    ? (prices[mid - 1] + prices[mid]) / 2
    : prices[mid]
  const avg = prices.reduce((acc, n) => acc + n, 0) / prices.length

  return {
    count: prices.length,
    median,
    avg,
    min: prices[0],
    max: prices[prices.length - 1]
  }
}

function extractCompPricesFromText(rawText) {
  const text = String(rawText || '')
  if (!text.trim()) return []

  const matches = [...text.matchAll(/\$?\s*([0-9]{1,4}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/g)]
  const numbers = matches
    .map((match) => Number(String(match[1] || '').replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 25000)

  return numbers
}

function buildMarketSearchQuery(item) {
  const parts = [
    item?.year,
    item?.set,
    item?.name,
    item?.cardNumber ? `#${item.cardNumber}` : '',
    item?.parallel,
    item?.team
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  return parts.join(' ')
}

function buildMarketSearchLinks(item) {
  const query = buildMarketSearchQuery(item)
  if (!query) return null

  const encoded = encodeURIComponent(query)
  return {
    ebaySold: `https://www.ebay.com/sch/i.html?_nkw=${encoded}&LH_Sold=1&LH_Complete=1`,
    oneThirtyPoint: `https://www.google.com/search?q=${encodeURIComponent(`site:130point.com/sales ${query}`)}`,
    priceCharting: `https://www.pricecharting.com/search-products?type=prices&q=${encoded}`
  }
}

function resolveEstimatedUnitValue(pricing = {}) {
  const preferred = parsePriceNumber(pricing.estimatedUnitValue)
  if (preferred !== null) return preferred

  const fromLastSale = parsePriceNumber(pricing.lastSale)
  if (fromLastSale !== null) return fromLastSale

  const fromListing = parsePriceNumber(pricing.listingPrice)
  if (fromListing !== null) return fromListing

  const fromPurchase = parsePriceNumber(pricing.purchasePrice)
  if (fromPurchase !== null) return fromPurchase

  return null
}

function resolveAverageCompValue(estimate = null) {
  const avg = parsePriceNumber(estimate?.avg)
  if (avg !== null) return avg
  const median = parsePriceNumber(estimate?.median)
  if (median !== null) return median
  return null
}

function resolveMedianCompValue(estimate = null) {
  const median = parsePriceNumber(estimate?.median)
  if (median !== null) return median
  return resolveAverageCompValue(estimate)
}

function resolvePricingDisplay(pricing = {}, estimate = null) {
  const avgFallbackValue = resolveAverageCompValue(estimate)
  const medianFallbackValue = resolveMedianCompValue(estimate)
  const avgFallback = avgFallbackValue !== null ? avgFallbackValue.toFixed(2) : ''
  const medianFallback = medianFallbackValue !== null ? medianFallbackValue.toFixed(2) : ''

  const source = cleanStaleInventoryHint(String(pricing.source || '').trim())
  const isPlaceholderFallback = source === 'fallback_default' || source === 'no_comps'
  const resolvedLastSale = isPlaceholderFallback ? '' : String(pricing.lastSale || '').trim()
  const resolvedEstimatedUnitValue = isPlaceholderFallback ? '' : String(pricing.estimatedUnitValue || '').trim()

  return {
    purchasePrice: String(pricing.purchasePrice || '').trim(),
    listingPrice: String(pricing.listingPrice || '').trim(),
    lastSale: resolvedLastSale || medianFallback,
    estimatedUnitValue: resolvedEstimatedUnitValue || avgFallback,
    source: source || (estimate?.query ? `Auto: ${estimate.query}` : '')
  }
}

function renderPricingTable(items = inventoryRowsCache) {
  if (!pricingBody) return
  const groupedItems = aggregatePricingItems(items)

  if (!groupedItems.length) {
    pricingBody.innerHTML = '<tr><td colspan="15">No inventory rows available for pricing yet.</td></tr>'
    return
  }

  const pricingById = getPricingState()
  pricingBody.innerHTML = ''

  groupedItems.forEach((item) => {
    const row = document.createElement('tr')
    const id = String(item?.id || '')
    const pricingKey = String(item?.pricingKey || buildPricingFingerprint(item) || id)
    const pricing = pricingById[pricingKey] || pricingById[id] || {}
    const estimate = pricingEstimateByFingerprint[pricingKey] || null
    const display = resolvePricingDisplay(pricing, estimate)
    const qty = Number(item?.quantity || 1)
    const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1
    const estimatedUnitValue = resolveEstimatedUnitValue({ ...pricing, ...display })
    const estimatedTotalValue = estimatedUnitValue !== null ? estimatedUnitValue * safeQty : null
    const marketLinks = buildMarketSearchLinks(item)
    const sourceText = display.source || (marketLinks ? 'eBay sold + marketplace comps' : '')

    row.innerHTML = `
      <td>${id}</td>
      <td>${item?.sku || ''}</td>
      <td>${item?.name || ''}</td>
      <td>${item?.set || ''}</td>
      <td>${item?.year || ''}</td>
      <td>${safeQty}</td>
      <td><input type="number" step="0.01" class="pricing-input" data-field="purchasePrice" value="${display.purchasePrice}" /></td>
      <td><input type="number" step="0.01" class="pricing-input" data-field="listingPrice" value="${display.listingPrice}" /></td>
      <td><input type="number" step="0.01" class="pricing-input" data-field="lastSale" value="${display.lastSale}" /></td>
      <td><input type="number" step="0.01" class="pricing-input" data-field="estimatedUnitValue" value="${display.estimatedUnitValue}" placeholder="Auto from comps" /></td>
      <td>${formatCurrency(estimatedTotalValue)}</td>
      <td><input type="text" class="pricing-input" data-field="source" value="${sourceText}" /></td>
      <td><input type="text" class="pricing-input" data-field="notes" value="${cleanStaleInventoryHint(pricing.notes || '')}" /></td>
      <td>
        ${marketLinks ? `<a href="${marketLinks.ebaySold}" target="_blank" rel="noopener noreferrer">eBay Sold</a> · <a href="${marketLinks.oneThirtyPoint}" target="_blank" rel="noopener noreferrer">130point Search</a> · <a href="${marketLinks.priceCharting}" target="_blank" rel="noopener noreferrer">PriceCharting</a>` : '-'}
      </td>
      <td></td>
    `

    const actionsCell = row.lastElementChild
    const saveBtn = document.createElement('button')
    saveBtn.type = 'button'
    saveBtn.textContent = 'Save'
    saveBtn.addEventListener('click', () => {
      const inputs = [...row.querySelectorAll('.pricing-input')]
      const next = inputs.reduce((acc, input) => {
        acc[input.dataset.field] = String(input.value || '').trim()
        return acc
      }, {})

      pricingById[pricingKey] = next
      setPricingState(pricingById)
      showPricingStatus(`Saved pricing for ${item?.sku || id}.`)
      renderPricingTable(groupedItems)
    })

    const pasteCompsBtn = document.createElement('button')
    pasteCompsBtn.type = 'button'
    pasteCompsBtn.className = 'secondary-btn'
    pasteCompsBtn.textContent = 'Paste Comps'
    pasteCompsBtn.addEventListener('click', () => {
      const promptText = window.prompt(
        'Paste sold prices (one per line or copied results text). Example: 12.99\\n10.50\\n$14.25',
        ''
      )
      if (promptText === null) return

      const parsedPrices = extractCompPricesFromText(promptText)
      const summary = summarizeCompPrices(parsedPrices)
      if (!summary.count || !Number.isFinite(summary.median)) {
        showPricingStatus('No valid sold prices found in pasted text.', true)
        return
      }

      const existing = pricingById[pricingKey] || {}
      const next = {
        ...existing,
        lastSale: Number(summary.median).toFixed(2),
        estimatedUnitValue: Number(summary.median).toFixed(2),
        source: `Manual comps (${summary.count}): min ${formatCurrency(summary.min)}, med ${formatCurrency(summary.median)}, max ${formatCurrency(summary.max)}`,
        notes: String(existing.notes || '').trim()
      }

      pricingById[pricingKey] = next
      setPricingState(pricingById)
      showPricingStatus(`Applied ${summary.count} sold comps for ${item?.sku || id}.`)
      renderPricingTable(groupedItems)
    })

    actionsCell.appendChild(saveBtn)
    actionsCell.appendChild(pasteCompsBtn)
    pricingBody.appendChild(row)
  })
}

async function refreshPricingEstimates(items = inventoryRowsCache, { force = false } = {}) {
  const grouped = aggregatePricingItems(items)
  if (!grouped.length) {
    pricingEstimateByFingerprint = {}
    setPricingEstimateState({})
    renderPricingTable(items)
    return
  }

  const persisted = getPricingEstimateState()
  const now = Date.now()
  grouped.forEach((item) => {
    const fp = String(item?.pricingKey || '')
    const cached = persisted[fp]
    if (!cached?.updatedAt) return
    const age = now - Number(cached.updatedAt || 0)
    if (age < 1000 * 60 * 60 * 12) {
      pricingEstimateByFingerprint[fp] = cached
    }
  })

  const usableEstimateCount = grouped.reduce((acc, item) => {
    const fp = String(item?.pricingKey || '')
    const estimate = pricingEstimateByFingerprint[fp]
    const hasMedian = Number.isFinite(Number(estimate?.median))
    const hasSamples = Number(estimate?.count || 0) > 0
    return acc + (hasMedian || hasSamples ? 1 : 0)
  }, 0)

  if (!force && usableEstimateCount >= grouped.length) {
    renderPricingTable(items)
    return
  }

  try {
    showPricingStatus('Refreshing market estimates from recent sold listings...')
    const backendUrl = await getBackendUrl()
    const payload = {
      cards: grouped.map((item) => ({
        sport: item?.sport,
        name: item?.name,
        team: item?.team,
        set: item?.set,
        year: item?.year,
        cardNumber: item?.cardNumber,
        parallel: item?.parallel
      }))
    }

    const res = await fetch(`${backendUrl}/inventory/pricing/estimate-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to fetch market estimates')
    }

    const estimates = Array.isArray(data?.estimates) ? data.estimates : []
    estimates.forEach((entry) => {
      const fp = String(entry?.fingerprint || '').trim()
      if (!fp) return
      pricingEstimateByFingerprint[fp] = {
        ...entry,
        updatedAt: Date.now()
      }
    })

    const pricingById = getPricingState()
    let pricingUpdated = 0
    grouped.forEach((item) => {
      const pricingKey = String(item?.pricingKey || '')
      if (!pricingKey) return

      const estimate = pricingEstimateByFingerprint[pricingKey]
      const avgCompValue = resolveAverageCompValue(estimate)
      if (avgCompValue === null) return

      const existing = pricingById[pricingKey] || {}
      const hasManualUnitValue = parsePriceNumber(existing.estimatedUnitValue) !== null
      const isAutoManaged = String(existing.source || '').toLowerCase().startsWith('auto:')
      if (hasManualUnitValue && !isAutoManaged && !force) return

      const medianCompValue = resolveMedianCompValue(estimate)
      const countText = Number(estimate?.count || 0) > 0 ? `${Number(estimate.count)} sold comps` : 'sold comps unavailable'
      const sourceSystem = String(estimate?.source || '').trim() || 'market'
      const next = {
        ...existing,
        estimatedUnitValue: avgCompValue.toFixed(2),
        source: `Auto: ${sourceSystem} avg (${countText})`,
        notes: String(existing.notes || '').trim()
      }

      if (parsePriceNumber(existing.lastSale) === null && medianCompValue !== null) {
        next.lastSale = medianCompValue.toFixed(2)
      }

      pricingById[pricingKey] = next
      pricingUpdated += 1
    })

    if (pricingUpdated > 0) {
      setPricingState(pricingById)
    }

    setPricingEstimateState(pricingEstimateByFingerprint)
    renderPricingTable(items)
    showPricingStatus(`Updated market estimates for ${estimates.length} card profile(s); auto-filled Unit Value on ${pricingUpdated} row(s).`)
  } catch (err) {
    renderPricingTable(items)
    showPricingStatus(`Market estimate refresh failed: ${err.message || 'Unknown error'}`, true)
  }
}

function renderInventoryTable(items = inventoryRowsCache) {
  if (!inventoryBody) return

  if (!Array.isArray(items) || !items.length) {
    inventoryBody.innerHTML = '<tr><td colspan="9">No cards in inventory for this sport yet.</td></tr>'
    return
  }

  inventoryBody.innerHTML = ''
  items.forEach((item) => {
    const row = document.createElement('tr')

    row.innerHTML = `
      <td>${item.sku || ''}</td>
      <td>${item.name || ''}</td>
      <td>${item.team || ''}</td>
      <td>${item.set || ''}</td>
      <td>${item.year || ''}</td>
      <td>${item.cardNumber || ''}</td>
      <td>${item.quantity || 1}</td>
      <td>${item.updatedAt ? new Date(item.updatedAt).toLocaleString() : ''}</td>
      <td><div class="inventory-actions"></div></td>
    `

    const actionsCell = row.querySelector('.inventory-actions')
    const detailButton = document.createElement('button')
    detailButton.type = 'button'
    detailButton.textContent = 'Details'
    detailButton.addEventListener('click', () => {
      openInventoryDetailModal(item)
    })

    const deleteButton = document.createElement('button')
    deleteButton.type = 'button'
    deleteButton.textContent = 'Delete'
    deleteButton.className = 'secondary-btn'
    deleteButton.addEventListener('click', async () => {
      await deleteInventoryRow(item.id)
    })

    actionsCell?.appendChild(detailButton)
    actionsCell?.appendChild(deleteButton)

    inventoryBody.appendChild(row)
  })
}

function closeInventoryDetailModal() {
  if (inventoryDetailModal) inventoryDetailModal.classList.remove('active')
  activeInventoryDetailId = ''
}

function openInventoryDetailModal(item) {
  if (!item?.id || !inventoryDetailModal) return

  activeInventoryDetailId = String(item.id)
  if (inventoryDetailSummary) {
    const summary = [item?.year, item?.set, item?.name, item?.cardNumber ? `#${item.cardNumber}` : '']
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ')
    inventoryDetailSummary.textContent = summary || `Inventory ID: ${String(item?.id || '').trim()}`
  }

  if (inventoryDetailSportInput) inventoryDetailSportInput.value = String(item?.sport || '').trim()
  if (inventoryDetailSkuInput) inventoryDetailSkuInput.value = String(item?.sku || '').trim()
  if (inventoryDetailNameInput) inventoryDetailNameInput.value = String(item?.name || '').trim()
  if (inventoryDetailTeamInput) inventoryDetailTeamInput.value = String(item?.team || '').trim()
  if (inventoryDetailPositionInput) inventoryDetailPositionInput.value = String(item?.position || '').trim()
  if (inventoryDetailSetInput) inventoryDetailSetInput.value = String(item?.set || '').trim()
  if (inventoryDetailYearInput) inventoryDetailYearInput.value = String(item?.year || '').trim()
  if (inventoryDetailCardNumberInput) inventoryDetailCardNumberInput.value = String(item?.cardNumber || '').trim()
  if (inventoryDetailQuantityInput) inventoryDetailQuantityInput.value = String(item?.quantity || 1)
  if (inventoryDetailParallelInput) inventoryDetailParallelInput.value = String(item?.parallel || '').trim()
  if (inventoryDetailRookieSelect) inventoryDetailRookieSelect.value = String(item?.rookie || 'No').trim() || 'No'
  if (inventoryDetailAutographSelect) inventoryDetailAutographSelect.value = String(item?.autograph || 'No').trim() || 'No'
  if (inventoryDetailPickFromInput) inventoryDetailPickFromInput.value = String(item?.pickFrom || '').trim()
  if (inventoryDetailFilenameInput) inventoryDetailFilenameInput.value = String(item?.filename || '').trim()
  if (inventoryDetailPictureUrlInput) inventoryDetailPictureUrlInput.value = String(item?.pictureUrl || '').trim()
  if (inventoryDetailTitleInput) inventoryDetailTitleInput.value = String(item?.title || '').trim()
  if (inventoryDetailDescriptionInput) inventoryDetailDescriptionInput.value = String(item?.description || '').trim()

  inventoryDetailModal.classList.add('active')
}

function collectInventoryDetailPayload() {
  const quantityRaw = Number(inventoryDetailQuantityInput?.value || 1)
  const quantity = Number.isFinite(quantityRaw) ? Math.max(1, Math.round(quantityRaw)) : 1

  return {
    sport: String(inventoryDetailSportInput?.value || '').trim(),
    sku: String(inventoryDetailSkuInput?.value || '').trim(),
    name: String(inventoryDetailNameInput?.value || '').trim(),
    team: String(inventoryDetailTeamInput?.value || '').trim(),
    position: String(inventoryDetailPositionInput?.value || '').trim(),
    set: String(inventoryDetailSetInput?.value || '').trim(),
    year: String(inventoryDetailYearInput?.value || '').trim(),
    cardNumber: String(inventoryDetailCardNumberInput?.value || '').trim(),
    quantity,
    parallel: String(inventoryDetailParallelInput?.value || '').trim(),
    rookie: String(inventoryDetailRookieSelect?.value || 'No').trim() || 'No',
    autograph: String(inventoryDetailAutographSelect?.value || 'No').trim() || 'No',
    pickFrom: String(inventoryDetailPickFromInput?.value || '').trim(),
    filename: String(inventoryDetailFilenameInput?.value || '').trim(),
    pictureUrl: String(inventoryDetailPictureUrlInput?.value || '').trim(),
    title: String(inventoryDetailTitleInput?.value || '').trim(),
    description: String(inventoryDetailDescriptionInput?.value || '').trim()
  }
}

async function saveInventoryDetailModalChanges() {
  const id = String(activeInventoryDetailId || '').trim()
  if (!id) {
    showInventoryStatus('No inventory record selected for detail save.', true)
    return
  }

  const payload = collectInventoryDetailPayload()
  await updateInventoryRow(id, payload)
  closeInventoryDetailModal()
}

function appendClientLog(level, message, details = null) {
  const entry = {
    time: new Date().toISOString(),
    level,
    message: String(message || ''),
    details
  }
  clientRuntimeLogs.push(entry)
  if (clientRuntimeLogs.length > CLIENT_LOG_LIMIT) {
    clientRuntimeLogs.shift()
  }
}

window.addEventListener('error', (event) => {
  appendClientLog('error', event?.message || 'Unhandled window error', {
    source: event?.filename || '',
    line: event?.lineno || 0,
    column: event?.colno || 0
  })
})

window.addEventListener('unhandledrejection', (event) => {
  appendClientLog('error', 'Unhandled promise rejection', {
    reason: String(event?.reason || '')
  })
})

function normalizePrefillValue(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function splitPrefillEntries(value) {
  return String(value || '')
    .split(/[,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function addPrefillEntries(kind, rawValue) {
  const entries = Array.isArray(rawValue) ? rawValue : splitPrefillEntries(rawValue)
  if (!entries.length) return

  const target = kind === 'team' ? selectedPrefillTeams : selectedPrefillSets
  entries.forEach((entry) => {
    if (!entry) return
    const exists = target.some((item) => normalizePrefillValue(item) === normalizePrefillValue(entry))
    if (!exists) target.push(entry)
  })

  if (kind === 'team') renderPrefillSelections()
  else renderSetOptions()
}

function removePrefillEntry(kind, value) {
  const normalized = normalizePrefillValue(value)
  if (kind === 'team') {
    selectedPrefillTeams = selectedPrefillTeams.filter((item) => normalizePrefillValue(item) !== normalized)
  } else {
    selectedPrefillSets = selectedPrefillSets.filter((item) => normalizePrefillValue(item) !== normalized)
  }
  if (kind === 'team') renderPrefillSelections()
  else renderSetOptions()
}

function renderPrefillSelections() {
  const values = selectedPrefillTeams
  const container = prefillTeamChips
  if (!container) return
  container.innerHTML = ''

  values.forEach((value) => {
    const chip = document.createElement('span')
    chip.className = 'prefill-chip'
    chip.textContent = value

    const removeBtn = document.createElement('button')
    removeBtn.type = 'button'
    removeBtn.setAttribute('aria-label', `Remove ${value}`)
    removeBtn.textContent = 'x'
    removeBtn.addEventListener('click', () => removePrefillEntry('team', value))

    chip.appendChild(removeBtn)
    container.appendChild(chip)
  })
}

function formatCatalogSetLabel(setItem) {
  const year = String(setItem?.year || '').trim()
  const brand = String(setItem?.brand || '').trim()
  const setName = String(setItem?.setName || '').trim()
  return [year, brand, setName].filter(Boolean).join(' ').trim() || setName || brand || year || 'Unknown set'
}

function getMergedSetOptions() {
  const merged = []
  const seen = new Set()

  const push = (value, label = value) => {
    const clean = String(value || '').trim()
    const cleanLabel = String(label || clean).trim()
    const key = normalizePrefillValue(clean)
    if (!clean || !key || seen.has(key)) return
    seen.add(key)
    merged.push({ value: clean, label: cleanLabel })
  }

  catalogSetOptions.forEach((setItem) => push(formatCatalogSetLabel(setItem)))
  getPrefillOptionsForKind('set').forEach((item) => push(item))
  selectedPrefillSets.forEach((item) => push(item))

  return merged
}

function renderSetOptions() {
  if (!prefillSetChecklist) return

  const options = getMergedSetOptions()
  const selectedKeys = new Set(selectedPrefillSets.map((item) => normalizePrefillValue(item)))

  prefillSetChecklist.innerHTML = ''

  if (!options.length) {
    const emptyState = document.createElement('div')
    emptyState.className = 'prefill-set-empty'
    emptyState.textContent = 'No sets found'
    prefillSetChecklist.appendChild(emptyState)
    return
  }

  options.forEach((option) => {
    const wrapper = document.createElement('label')
    wrapper.className = 'prefill-set-option'

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = selectedKeys.has(normalizePrefillValue(option.value))
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        addPrefillEntries('set', option.value)
      } else {
        removePrefillEntry('set', option.value)
      }
    })

    const text = document.createElement('span')
    text.textContent = option.label

    wrapper.appendChild(checkbox)
    wrapper.appendChild(text)
    prefillSetChecklist.appendChild(wrapper)
  })
}

function commitPendingPrefillInput(kind) {
  const input = kind === 'team' ? prefillTeamInput : prefillSetInput
  const value = String(input?.value || '').trim()
  if (!value) return
  addPrefillEntries(kind, value)
  if (input) input.value = ''
  if (kind === 'set') renderSetOptions()
}

function prefillHistoryKey(kind) {
  return `cardAutoPrefill:${activeSport()}:${kind}`
}

function getPrefillHistory(kind) {
  try {
    const parsed = JSON.parse(localStorage.getItem(prefillHistoryKey(kind)) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function getPrefillOptionsForKind(kind) {
  const saved = getPrefillHistory(kind)
  const defaults = (kind === 'team' && activeSport() === 'Football') ? NFL_TEAM_OPTIONS : []
  const merged = [...saved, ...defaults]
  const deduped = []
  const seen = new Set()

  merged.forEach((item) => {
    const clean = String(item || '').trim()
    if (!clean) return
    const key = normalizePrefillValue(clean)
    if (!key || seen.has(key)) return
    seen.add(key)
    deduped.push(clean)
  })

  return deduped
}

function clearPrefillHistory(kind) {
  const suffix = `:${kind}`
  const keysToRemove = []

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key) continue
    if (key.startsWith('cardAutoPrefill:') && key.endsWith(suffix)) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key))
  renderPrefillHistoryOptions()
  if (kind === 'set') renderSetOptions()
}

function getYearOptions() {
  return [...ALLOWED_CARD_YEARS]
}

function renderYearChecklist() {
  if (!prefillYearChecklist || !prefillYearSummary) return

  const options = getYearOptions()
  prefillYearChecklist.innerHTML = ''

  options.forEach((yearValue) => {
    const label = document.createElement('label')
    label.className = 'prefill-year-option'

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = selectedPrefillYears.includes(yearValue)
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        if (!selectedPrefillYears.includes(yearValue)) selectedPrefillYears.push(yearValue)
      } else {
        selectedPrefillYears = selectedPrefillYears.filter((value) => value !== yearValue)
      }
      renderYearChecklist()
    })

    const text = document.createElement('span')
    text.textContent = yearValue

    label.appendChild(checkbox)
    label.appendChild(text)
    prefillYearChecklist.appendChild(label)
  })

  const sortedYears = [...selectedPrefillYears].map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (sortedYears.length === 1) {
    prefillYearSummary.textContent = String(sortedYears[0])
  } else if (sortedYears.length === 2) {
    prefillYearSummary.textContent = `${sortedYears[0]}-${sortedYears[1]}`
  } else if (sortedYears.length > 2) {
    prefillYearSummary.textContent = `${sortedYears[0]}-${sortedYears[sortedYears.length - 1]}`
  } else {
    prefillYearSummary.textContent = 'Select year options'
  }
}

function derivePrefillYearValue() {
  const sortedYears = [...selectedPrefillYears].map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!sortedYears.length) return ''
  if (sortedYears.length === 1) return String(sortedYears[0])
  if (sortedYears.length === 2) return `${sortedYears[0]}-${sortedYears[1]}`
  return `${sortedYears[0]}-${sortedYears[sortedYears.length - 1]}`
}

function reduceBrowserAutocompleteNoise() {
  const lockInput = (input, baseName) => {
    if (!input) return
    input.setAttribute('autocomplete', 'off')
    input.setAttribute('autocorrect', 'off')
    input.setAttribute('autocapitalize', 'off')
    input.setAttribute('spellcheck', 'false')
    input.setAttribute('name', `${baseName}-${Date.now()}`)
  }

  lockInput(prefillTeamInput, 'prefill-team')
  lockInput(prefillSetInput, 'prefill-set')
}

function savePrefillHistoryValue(kind, value) {
  const clean = String(value || '').trim()
  if (!clean) return
  const next = [clean, ...getPrefillHistory(kind).filter((item) => item !== clean)].slice(0, 12)
  localStorage.setItem(prefillHistoryKey(kind), JSON.stringify(next))
}

function renderPrefillHistoryOptions() {
  if (prefillTeamOptions) {
    prefillTeamOptions.innerHTML = ''
    getPrefillOptionsForKind('team').forEach((item) => {
      const option = document.createElement('option')
      option.value = item
      prefillTeamOptions.appendChild(option)
    })
  }
  renderSetOptions()
}

function updateQueuedFileFeedback(files) {
  void files
}

async function loadCatalogSetOptions() {
  try {
    const backendUrl = await getBackendUrl()
    const sport = encodeURIComponent(activeSport())
    const res = await fetch(`${backendUrl}/catalog/sets?sport=${sport}`)
    const data = await res.json()
    catalogSetOptions = Array.isArray(data?.items) ? data.items : []
  } catch (err) {
    console.warn('Could not load catalog set options', err)
    catalogSetOptions = []
  }
  renderSetOptions()
}

async function preScanImportFiles(files) {
  const sampleFiles = (files || []).slice(0, 1)
  const sets = []
  const teams = []
  const years = []

  const results = await Promise.all(sampleFiles.map(async (file) => {
    try {
      const buffer = await file.arrayBuffer()
      return await analyzeImageBuffer(buffer)
    } catch (err) {
      console.warn('Import pre-scan failed for a file', err)
      return null
    }
  }))

  results.forEach((result) => {
    if (!result) return
    const setValue = String(result?.set || '').trim()
    const teamValue = String(result?.team || '').trim()
    const yearValue = String(result?.year || '').trim()
    if (setValue) sets.push(setValue)
    if (teamValue) teams.push(teamValue)
    if (yearValue) years.push(yearValue)
  })

  return {
    sets,
    teams,
    years
  }
}

async function openImportPrefillDialog(files) {
  if (!files?.length || !importPrefillModal) return
  pendingImportFiles = files
  startProgress('Scanning imported cards for suggested set options...', Math.max(1, Math.min(files.length, 2)))
  const preScan = await preScanImportFiles(files)
  finishProgress('Scan complete. Review the suggested defaults below.')

  await loadCatalogSetOptions()

  const catalogSuggestion = preScan.sets[0] || ''
  const catalogSuggestionKey = normalizePrefillValue(catalogSuggestion)
  const catalogMatch = catalogSetOptions.find((setItem) => normalizePrefillValue(formatCatalogSetLabel(setItem)) === catalogSuggestionKey)
  selectedPrefillSets = [catalogMatch ? formatCatalogSetLabel(catalogMatch) : catalogSuggestion].filter(Boolean)
  selectedPrefillTeams = [...new Set(preScan.teams)].slice(0, 3)
  selectedPrefillYears = ['2025', '2026']

  renderPrefillHistoryOptions()
  updateQueuedFileFeedback(files)

  const pairCount = Math.ceil(files.length / 2)
  if (prefillImportSummary) {
    const setLabel = selectedPrefillSets[0] || 'database sets'
    prefillImportSummary.textContent = `Scanned ${files.length} image${files.length === 1 ? '' : 's'} across ${pairCount} pair${pairCount === 1 ? '' : 's'}. Suggested set: ${setLabel}.`
  }

  if (prefillTeamInput) prefillTeamInput.value = ''
  if (prefillSetInput) prefillSetInput.value = ''
  renderPrefillSelections()
  renderSetOptions()
  renderYearChecklist()

  importPrefillModal.classList.add('active')
}

function closeImportPrefillDialog() {
  if (!importPrefillModal) return
  importPrefillModal.classList.remove('active')
  pendingImportFiles = []
}

function collectImportPrefill() {
  commitPendingPrefillInput('team')
  commitPendingPrefillInput('set')

  return {
    teams: [...selectedPrefillTeams],
    sets: [...selectedPrefillSets],
    year: derivePrefillYearValue()
  }
}

function setFeedbackStatus(message, isError = false) {
  if (!feedbackStatus) return
  feedbackStatus.style.display = message ? 'block' : 'none'
  feedbackStatus.style.color = isError ? '#b00' : '#256f2f'
  feedbackStatus.textContent = message || ''
}

function closeHelpMenu() {
  if (!helpMenuDropdown || !helpMenuToggle) return
  helpMenuDropdown.classList.remove('active')
  helpMenuToggle.setAttribute('aria-expanded', 'false')
}

function openFeedbackModal(type) {
  if (!feedbackModal) return
  activeFeedbackType = type === 'defect' ? 'defect' : 'feedback'
  if (feedbackModalTitle) {
    feedbackModalTitle.textContent = activeFeedbackType === 'defect' ? 'Submit Defect Report' : 'Submit Feedback'
  }
  if (feedbackTitleInput) feedbackTitleInput.value = ''
  if (feedbackMessageInput) feedbackMessageInput.value = ''
  setFeedbackStatus('')
  feedbackModal.classList.add('active')
  closeHelpMenu()
}

function closeFeedbackDialog() {
  if (!feedbackModal) return
  feedbackModal.classList.remove('active')
  setFeedbackStatus('')
}

async function submitFeedbackReport() {
  if (!submitFeedbackBtn || !feedbackTitleInput || !feedbackMessageInput) return
  const title = String(feedbackTitleInput.value || '').trim()
  const details = String(feedbackMessageInput.value || '').trim()
  const contactEmail = String(feedbackEmailInput?.value || '').trim()

  if (!title || !details) {
    setFeedbackStatus('Please enter both a title and details before submitting.', true)
    return
  }

  submitFeedbackBtn.disabled = true
  setFeedbackStatus('Submitting report...')
  appendClientLog('info', `Submitting ${activeFeedbackType} report`, { title })

  try {
    const backendUrl = await getBackendUrl()
    const payload = {
      type: activeFeedbackType,
      title,
      details,
      contactEmail,
      app: {
        build: FRONTEND_BUILD,
        sport: activeSport(),
        url: typeof window !== 'undefined' ? window.location.href : ''
      },
      client: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        logs: clientRuntimeLogs.slice(-60)
      }
    }

    const response = await fetch(`${backendUrl}/feedback/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const result = await response.json()

    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || 'Feedback submission failed')
    }

    setFeedbackStatus(result.message || 'Report submitted successfully.')
    setTimeout(() => closeFeedbackDialog(), 900)
  } catch (err) {
    setFeedbackStatus(`Submission failed: ${err.message || 'Unknown error'}`, true)
  } finally {
    submitFeedbackBtn.disabled = false
  }
}

function triggerFilePicker() {
  fileInput?.click()
}

function queueFilesForImport(files) {
  const cleanFiles = sortImportedFiles((files || []).filter(Boolean))
  if (!cleanFiles.length) return
  updateQueuedFileFeedback(cleanFiles)
  void openImportPrefillDialog(cleanFiles)
}

function sortImportedFiles(files) {
  return [...files].sort((a, b) => {
    const aPath = String(a?.webkitRelativePath || a?.name || '')
    const bPath = String(b?.webkitRelativePath || b?.name || '')
    if (aPath !== bPath) return aPath.localeCompare(bPath, undefined, { numeric: true, sensitivity: 'base' })

    const aTime = Number(a?.lastModified || 0)
    const bTime = Number(b?.lastModified || 0)
    if (aTime !== bTime) return aTime - bTime

    const aSize = Number(a?.size || 0)
    const bSize = Number(b?.size || 0)
    if (aSize !== bSize) return aSize - bSize

    return 0
  })
}

function applyImportPrefillToRow(row, prefill) {
  if (!row || !prefill) return

  const chooseCandidate = (options, currentValue) => {
    const cleanOptions = (options || []).map((item) => String(item || '').trim()).filter(Boolean)
    if (!cleanOptions.length) return ''
    if (cleanOptions.length === 1) return cleanOptions[0]

    const normalizedCurrent = normalizePrefillValue(currentValue)
    if (!normalizedCurrent) return ''

    let best = ''
    let bestScore = 0

    cleanOptions.forEach((option) => {
      const normalizedOption = normalizePrefillValue(option)
      let score = 0
      if (!normalizedOption) return
      if (normalizedCurrent === normalizedOption) score = 100
      else if (normalizedCurrent.includes(normalizedOption) || normalizedOption.includes(normalizedCurrent)) score = 70
      else {
        const optionTokens = new Set(normalizedOption.split(' ').filter(Boolean))
        const currentTokens = new Set(normalizedCurrent.split(' ').filter(Boolean))
        let overlap = 0
        optionTokens.forEach((token) => {
          if (currentTokens.has(token)) overlap += 1
        })
        score = overlap * 20
      }

      if (score > bestScore) {
        bestScore = score
        best = option
      }
    })

    return bestScore >= 40 ? best : ''
  }

  const teamInput = row.querySelector('.team')
  const setInput = row.querySelector('.set')
  const yearInput = row.querySelector('.year')

  if (teamInput) {
    const chosenTeam = chooseCandidate(prefill.teams, teamInput.value)
    if (chosenTeam) teamInput.value = chosenTeam
    else if (!String(teamInput.value || '').trim() && prefill.teams?.length === 1) teamInput.value = prefill.teams[0]
  }

  if (setInput) {
    const chosenSet = chooseCandidate(prefill.sets, setInput.value)
    if (chosenSet) setInput.value = chosenSet
    else if (!String(setInput.value || '').trim() && prefill.sets?.length === 1) setInput.value = prefill.sets[0]
  }

  const yearValue = String(prefill.year || '').trim()
  if (yearInput && yearValue && !String(yearInput.value || '').trim()) {
    yearInput.value = yearValue
  }
}

function activeSport() {
  return String(sportSelect?.value || 'Football')
}

function updateOpenChecklistButtonState() {
  if (!syncOpenChecklistBtn) return

  const sport = activeSport()
  const supported = OPEN_CHECKLIST_SUPPORTED_SPORTS.has(sport)
  syncOpenChecklistBtn.disabled = !supported
  syncOpenChecklistBtn.textContent = supported
    ? 'Sync Popular Open Checklist Sets'
    : `Open Checklist Not Available for ${sport}`
  syncOpenChecklistBtn.title = supported
    ? 'Preload popular sets from the Open Checklist repository.'
    : `Open Checklist currently only supports: ${Array.from(OPEN_CHECKLIST_SUPPORTED_SPORTS).join(', ')}`
}

function getScanDraftDb() {
  if (scanDraftDbPromise) return scanDraftDbPromise

  scanDraftDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(SCAN_DRAFT_DB_NAME, 1)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(SCAN_DRAFT_STORE)) {
        db.createObjectStore(SCAN_DRAFT_STORE, { keyPath: 'id' })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('Failed to open scan draft DB'))
  })

  return scanDraftDbPromise
}

async function idbPutDraft(record) {
  const db = await getScanDraftDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SCAN_DRAFT_STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('Failed to write scan draft'))
    tx.objectStore(SCAN_DRAFT_STORE).put(record)
  })
}

async function idbGetDraft() {
  const db = await getScanDraftDb()
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(SCAN_DRAFT_STORE, 'readonly')
    const req = tx.objectStore(SCAN_DRAFT_STORE).get(SCAN_DRAFT_RECORD_ID)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error || new Error('Failed to read scan draft'))
  })
}

async function idbDeleteDraft() {
  const db = await getScanDraftDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SCAN_DRAFT_STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('Failed to delete scan draft'))
    tx.objectStore(SCAN_DRAFT_STORE).delete(SCAN_DRAFT_RECORD_ID)
  })
}

function buildRowDraftEntry(row) {
  const data = collectRowData(row)

  return {
    data,
    frontBuffer: row.frontBuffer ? row.frontBuffer.slice(0) : null,
    backBuffer: row.backBuffer ? row.backBuffer.slice(0) : null,
    frontName: String(row.frontFile?.name || ''),
    backName: String(row.backFile?.name || ''),
    frontType: String(row.frontFile?.type || 'image/jpeg'),
    backType: String(row.backFile?.type || 'image/jpeg')
  }
}

function markScanDraftPersistFailure(err) {
  if (scanDraftPersistFailed) return
  scanDraftPersistFailed = true
  console.warn('Could not persist scan draft snapshot', err)

  const aiStatus = document.getElementById('aiStatus')
  if (aiStatus) {
    aiStatus.style.display = 'block'
    aiStatus.style.color = '#b00'
    aiStatus.textContent = 'Warning: Autosave for import recovery failed. Save current rows to inventory as soon as possible.'
  }
}

async function persistScanDraftSnapshotNow() {
  if (scanDraftPersistInFlight) return
  scanDraftPersistInFlight = true

  try {
    const rows = [...tableBody.querySelectorAll('tr')]
    const cards = rows.map((row) => buildRowDraftEntry(row))
    const payload = {
      id: SCAN_DRAFT_RECORD_ID,
      version: 2,
      savedAt: Date.now(),
      sport: activeSport(),
      cards
    }

    await idbPutDraft(payload)

    // Keep a lightweight fallback marker in localStorage.
    localStorage.setItem(SCAN_DRAFT_KEY, JSON.stringify({ version: 2, savedAt: payload.savedAt, sport: payload.sport, cardCount: cards.length }))
    scanDraftPersistFailed = false
  } catch (err) {
    markScanDraftPersistFailure(err)
  } finally {
    scanDraftPersistInFlight = false
  }
}

function persistScanDraftSnapshot() {
  if (scanDraftRestoreInProgress) return
  if (scanDraftPersistTimer) clearTimeout(scanDraftPersistTimer)
  scanDraftPersistTimer = setTimeout(() => {
    scanDraftPersistTimer = null
    void persistScanDraftSnapshotNow()
  }, 500)
}

function clearScanDraftSnapshot() {
  if (scanDraftPersistTimer) {
    clearTimeout(scanDraftPersistTimer)
    scanDraftPersistTimer = null
  }

  void idbDeleteDraft().catch((err) => {
    console.warn('Could not clear scan draft snapshot', err)
  })

  try { localStorage.removeItem(SCAN_DRAFT_KEY) } catch {}
}

function discardUnsavedScanDraft() {
  const rows = [...tableBody.querySelectorAll('tr')]
  if (!rows.length) {
    clearScanDraftSnapshot()
    const aiStatus = document.getElementById('aiStatus')
    if (aiStatus) {
      aiStatus.style.display = 'block'
      aiStatus.style.color = '#1c7c2e'
      aiStatus.textContent = 'No unsaved scan rows were present. Cleared any persisted draft snapshot.'
    }
    return
  }

  const confirmed = window.confirm(`Discard ${rows.length} unsaved scan row${rows.length === 1 ? '' : 's'} and clear recovery snapshot? This cannot be undone.`)
  if (!confirmed) return

  if (currentUploadSession && !currentUploadSession.cancelled) {
    currentUploadSession.cancelled = true
    currentUploadSession.controller.abort()
  }

  endSkuSession()
  forceSkuResetOnNextImport = true
  try {
    sessionStorage.removeItem(IMPORT_IN_PROGRESS_KEY)
  } catch {
    // Ignore storage write issues.
  }

  rows.forEach((row) => {
    revokeRowPreviewUrls(row)
    row.remove()
  })

  clearScanDraftSnapshot()
  updatePickFromOptions()
  if (typeof window.requestTableAutoSize === 'function') {
    window.requestTableAutoSize()
  }

  const aiStatus = document.getElementById('aiStatus')
  if (aiStatus) {
    aiStatus.style.display = 'block'
    aiStatus.style.color = '#1c7c2e'
    aiStatus.textContent = 'Unsaved scan draft discarded. Next import will restart SKUs at SKU-000001.'
  }
}

function restoreScanDraftSnapshot() {
  void (async () => {
    try {
      if ([...tableBody.querySelectorAll('tr')].length) return

      const snapshot = await idbGetDraft()
      const cards = Array.isArray(snapshot?.cards) ? snapshot.cards : []
      if (!cards.length) return

      scanDraftRestoreInProgress = true

      cards.forEach((entry) => {
        const frontFile = entry?.frontBuffer
          ? new File([entry.frontBuffer], entry.frontName || 'front.jpg', { type: entry.frontType || 'image/jpeg' })
          : null
        const backFile = entry?.backBuffer
          ? new File([entry.backBuffer], entry.backName || 'back.jpg', { type: entry.backType || 'image/jpeg' })
          : null

        const row = addRow(frontFile, entry?.frontBuffer || null, backFile, entry?.backBuffer || null)
        const card = entry?.data || {}

        row.querySelector('.side').value = String(card?.Side || row.querySelector('.side').value || '')
        row.querySelector('.sku').value = String(card?.SKU || row.querySelector('.sku').value || '')
        row.querySelector('.name').value = String(card?.Name || '')
        row.querySelector('.team').value = String(card?.Team || '')
        row.querySelector('.position').value = String(card?.Position || '')
        row.querySelector('.set').value = String(card?.Set || '')
        row.querySelector('.year').value = String(card?.Year || '')
        row.querySelector('.cardNumber').value = String(card?.CardNumber || '')
        row.querySelector('.quantity').value = String(card?.Quantity || '1')
        row.querySelector('.parallel').value = String(card?.Parallel || '')
        row.querySelector('.rookie').value = String(card?.Rookie || 'No')
        row.querySelector('.autograph').value = String(card?.Autograph || 'No')
        row.querySelector('.title').value = String(card?.Title || '')
        row.querySelector('.description').value = String(card?.Description || '')
        row.querySelector('.pickFrom').value = String(card?.PickFrom || '')
        row.querySelector('.filename').value = String(card?.Filename || '')
        row.querySelector('.pictureUrl').value = String(card?.PictureURL || '')
      })

      updatePickFromOptions()

      const aiStatus = document.getElementById('aiStatus')
      if (aiStatus) {
        aiStatus.style.display = 'block'
        aiStatus.style.color = '#1c7c2e'
        aiStatus.textContent = `Recovered ${cards.length} unsaved rows from previous interrupted import.`
      }
    } catch (err) {
      console.warn('Could not restore scan draft snapshot', err)
    } finally {
      scanDraftRestoreInProgress = false
    }
  })()
}

function setActivePage(page) {
  const safePage = resolveAllowedPage(page)
  const pages = [homePage, scanPage, inventoryPage, pricingPage, listingsPage, checklistPage, profilePage]
  pages.forEach((el) => {
    if (!el) return
    el.classList.remove('active')
  })

  const navButtons = [navHomeBtn, navScanBtn, navInventoryBtn, navPricingBtn, navListingsBtn, navChecklistBtn, navProfileBtn]
  navButtons.forEach((el) => {
    if (!el) return
    el.classList.remove('active')
    el.setAttribute('aria-selected', 'false')
  })

  const markNavActive = (button) => {
    if (!button) return
    button.classList.add('active')
    button.setAttribute('aria-selected', 'true')
  }

  if (safePage === 'scan') {
    scanPage?.classList.add('active')
    markNavActive(navScanBtn)
  } else if (safePage === 'inventory') {
    inventoryPage?.classList.add('active')
    markNavActive(navInventoryBtn)
  } else if (safePage === 'pricing') {
    pricingPage?.classList.add('active')
    markNavActive(navPricingBtn)
    renderPricingTable(inventoryRowsCache)
  } else if (safePage === 'listings') {
    listingsPage?.classList.add('active')
    markNavActive(navListingsBtn)
  } else if (safePage === 'checklist') {
    checklistPage?.classList.add('active')
    markNavActive(navChecklistBtn)
    loadChecklistCatalogData({ quiet: true }).catch(() => {})
  } else if (safePage === 'profile') {
    profilePage?.classList.add('active')
    markNavActive(navProfileBtn)
    ensureAuthProviders().catch(() => {})
    loadCurrentUserSession({ quiet: true }).catch(() => {})
  } else {
    homePage?.classList.add('active')
    markNavActive(navHomeBtn)
  }

  applyAuthLandingMode()

  try {
    localStorage.setItem(ACTIVE_PAGE_KEY, normalizeAppPage(safePage))
  } catch {
    // Ignore storage write issues (private mode / quota).
  }
}

function initScanCommandRibbon() {
  const tabs = [...document.querySelectorAll('[data-scan-ribbon-tab]')]
  const panels = [...document.querySelectorAll('[data-scan-ribbon-panel]')]
  if (!tabs.length || !panels.length) return

  const activateTab = (tabKey) => {
    const safeKey = String(tabKey || '').trim().toLowerCase()
    let hasActivePanel = false

    tabs.forEach((tab) => {
      const isActive = String(tab.dataset.scanRibbonTab || '').toLowerCase() === safeKey
      tab.classList.toggle('active', isActive)
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false')
    })

    panels.forEach((panel) => {
      const isActive = String(panel.dataset.scanRibbonPanel || '').toLowerCase() === safeKey
      panel.classList.toggle('active', isActive)
      if (isActive) hasActivePanel = true
    })

    if (!hasActivePanel) {
      const fallbackTab = tabs[0]
      const fallbackKey = String(fallbackTab?.dataset.scanRibbonTab || '').toLowerCase()
      if (fallbackKey && fallbackKey !== safeKey) {
        activateTab(fallbackKey)
      }
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activateTab(tab.dataset.scanRibbonTab)
    })
  })

  activateTab(tabs[0]?.dataset.scanRibbonTab || 'ai')
}

function getInitialActivePage() {
  const urlContext = getUrlContext()
  const contextPage = normalizeAppPage(urlContext.page)
  if (contextPage) {
    return resolveAllowedPage(contextPage)
  }

  try {
    const importInProgress = sessionStorage.getItem(IMPORT_IN_PROGRESS_KEY) === '1'
    if (importInProgress) {
      sessionStorage.removeItem(IMPORT_IN_PROGRESS_KEY)
      return resolveAllowedPage('scan')
    }
  } catch {
    // Ignore storage read issues.
  }

  try {
    const savedPage = String(localStorage.getItem(ACTIVE_PAGE_KEY) || '').trim().toLowerCase()
    if (savedPage) {
      return resolveAllowedPage(savedPage)
    }
  } catch {
    // Ignore storage read issues.
  }

  return resolveAllowedPage('home')
}

async function loadInventory() {
  if (!inventoryBody) return
  inventoryBody.innerHTML = '<tr><td colspan="9">Loading inventory...</td></tr>'

  try {
    const sport = encodeURIComponent(activeSport())
    const res = await fetchBackend(`/inventory?sport=${sport}`)
    const data = await res.json()
    const items = Array.isArray(data?.items) ? data.items : []
    inventoryRowsCache = items
    inventoryEditingRowId = ''
    renderInventoryTable(items)
    renderPricingTable(items)
    scrubScanPickFromValues()
    updatePickFromOptions()
    if (pricingPage?.classList.contains('active')) {
      await refreshPricingEstimates(items)
    }
    return items
  } catch (err) {
    inventoryRowsCache = []
    renderPricingTable([])
    inventoryBody.innerHTML = '<tr><td colspan="9">Failed to load inventory.</td></tr>'
    scrubScanPickFromValues()
    updatePickFromOptions()
    console.error('Inventory load failed:', err)
    return []
  }
}

async function rescanWorkspaceData(origin = 'scan') {
  const target = String(origin || 'scan').toLowerCase()
  const scopeLabel = activeSport()
  const aiStatus = document.getElementById('aiStatus')

  if (aiStatus) {
    aiStatus.style.display = 'block'
    aiStatus.style.color = '#3f4f8e'
    aiStatus.textContent = `Rescanning ${scopeLabel} data...`
  }
  showInventoryStatus(`Rescanning ${scopeLabel} inventory and pricing data...`)
  showPricingStatus(`Rescanning ${scopeLabel} inventory and pricing data...`)

  const items = await loadInventory()
  await refreshPricingEstimates(items, { force: true })
  scrubScanPickFromValues()
  updatePickFromOptions()

  const total = Array.isArray(items) ? items.length : 0
  const message = `Rescan complete for ${scopeLabel}: ${total} inventory row(s) loaded.`
  showInventoryStatus(message)
  showPricingStatus(message)

  if (aiStatus) {
    aiStatus.style.display = 'block'
    aiStatus.style.color = '#1c7c2e'
    aiStatus.textContent = message
  }

  if (target === 'pricing') {
    setActivePage('pricing')
  } else if (target === 'inventory') {
    setActivePage('inventory')
  } else {
    setActivePage('scan')
  }
}

async function openPricingAndAnalyze() {
  setActivePage('pricing')
  const items = await loadInventory()
  await refreshPricingEstimates(items, { force: true })
}

async function updateInventoryRow(id, payload) {
  try {
    const res = await fetchBackend(`/inventory/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to update inventory row')
    }

    inventoryEditingRowId = ''
    showInventoryStatus('Inventory row updated.')
    await loadInventory()
  } catch (err) {
    showInventoryStatus(`Inventory update failed: ${err.message || 'Unknown error'}`, true)
  }
}

async function deleteInventoryRow(id) {
  const confirmed = window.confirm('Delete this inventory row?')
  if (!confirmed) return

  try {
    const res = await fetchBackend(`/inventory/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })

    let data = null
    let rawText = ''
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      data = await res.json()
    } else {
      rawText = await res.text()
    }

    if (!res.ok) {
      const detail = data?.error || rawText || `HTTP ${res.status}`
      throw new Error(`Failed to delete inventory row: ${detail}`)
    }

    showInventoryStatus('Inventory row deleted.')
    await loadInventory()
  } catch (err) {
    showInventoryStatus(`Delete failed: ${err.message || 'Unknown error'}`, true)
  }
}

async function clearInventory(mode) {
  const isAll = mode === 'all'
  const sport = activeSport()
  const message = isAll
    ? 'Clear ALL inventory across all sports? This cannot be undone.'
    : `Clear all ${sport} inventory rows? This cannot be undone.`

  const confirmed = window.confirm(message)
  if (!confirmed) return

  try {
    const qs = isAll ? 'all=true' : `sport=${encodeURIComponent(sport)}`
    const res = await fetchBackend(`/inventory?${qs}`, { method: 'DELETE' })

    let data = null
    let rawText = ''
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      data = await res.json()
    } else {
      rawText = await res.text()
    }

    if (!res.ok) {
      const detail = data?.error || rawText || `HTTP ${res.status}`
      throw new Error(`Failed to clear inventory: ${detail}`)
    }

    const scopeLabel = isAll ? 'all sports' : sport
    showInventoryStatus(`Cleared ${data.deleted || 0} inventory rows for ${scopeLabel}.`)
    await loadInventory()
  } catch (err) {
    showInventoryStatus(`Clear inventory failed: ${err.message || 'Unknown error'}`, true)
  }
}

function showInventoryStatus(message, isError = false) {
  if (!inventoryStatus) return
  inventoryStatus.style.display = 'block'
  inventoryStatus.style.color = isError ? '#a52020' : '#3f4f8e'
  inventoryStatus.textContent = message
}

async function loadListingTemplates() {
  if (listingTemplatesLoaded) return

  try {
    const res = await fetchBackend('/catalog/templates')
    const data = await res.json()
    const items = Array.isArray(data?.items) ? data.items : []

    const selects = [listingTemplateSelect, listingsListingTemplateSelect].filter(Boolean)

    if (!items.length) {
      const option = document.createElement('option')
      option.value = ''
      option.textContent = 'No templates found'
      selects.forEach((select) => {
        select.innerHTML = ''
        select.appendChild(option.cloneNode(true))
      })
      return
    }

    selects.forEach((select) => {
      select.innerHTML = ''
      items.forEach((item) => {
        const option = document.createElement('option')
        option.value = item.id
        option.textContent = `${item.name} (${item.resolvedType || item.templateType})`
        select.appendChild(option)
      })
    })

    listingTemplatesLoaded = true
  } catch (err) {
    console.warn('Could not load listing templates', err)
    [listingTemplateSelect, listingsListingTemplateSelect].filter(Boolean).forEach((select) => {
      select.innerHTML = '<option value="">Templates unavailable</option>'
    })
  }
}

async function buildListingDraftFromInventory() {
  const controls = getListingUiControls()
  if (!controls.templateSelect || !controls.draftOutput) return

  const templateId = String(controls.templateSelect.value || '').trim()
  if (!templateId) {
    controls.statusOutput.style.display = 'block'
    controls.statusOutput.style.color = '#a52020'
    controls.statusOutput.textContent = 'Choose a template first.'
    return
  }

  const rawCardIds = String(controls.cardIdInput?.value || '').trim()
  if (!rawCardIds) {
    controls.statusOutput.style.display = 'block'
    controls.statusOutput.style.color = '#a52020'
    controls.statusOutput.textContent = 'Enter one or more card IDs first.'
    return
  }

  const cardIds = rawCardIds.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean)
  const payload = {
    templateId,
    cardIds,
    cardRef: rawCardIds
  }
  const rawChaseCardRef = String(controls.chaseCardInput?.value || '').trim()
  if (rawChaseCardRef) {
    payload.chaseCardId = rawChaseCardRef
    payload.chaseCardRef = rawChaseCardRef
  }

  try {
    controls.draftOutput.textContent = 'Building draft...'
    const res = await fetchBackend('/catalog/listing-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data?.error || 'Failed to build listing draft')
    }

    controls.draftOutput.textContent = JSON.stringify(data, null, 2)
    controls.statusOutput.style.display = 'block'
    controls.statusOutput.style.color = '#3f4f8e'
    controls.statusOutput.textContent = `Built ${data?.listing?.listingType || 'listing'} draft for ${cardIds.length} card(s).`
  } catch (err) {
    controls.draftOutput.textContent = `Draft build failed: ${err.message || 'Unknown error'}`
    controls.statusOutput.style.display = 'block'
    controls.statusOutput.style.color = '#a52020'
    controls.statusOutput.textContent = `Draft build failed: ${err.message || 'Unknown error'}`
  }
}

async function submitListingDraftToStorefront() {
  const controls = getListingUiControls()
  if (!controls.templateSelect || !controls.draftOutput) return

  const templateId = String(controls.templateSelect.value || '').trim()
  const rawCardIds = String(controls.cardIdInput?.value || '').trim()
  const rawChaseCardId = String(controls.chaseCardInput?.value || '').trim()

  if (!templateId) {
    controls.statusOutput.style.display = 'block'
    controls.statusOutput.style.color = '#a52020'
    controls.statusOutput.textContent = 'Choose a template first.'
    return
  }
  if (!rawCardIds) {
    controls.statusOutput.style.display = 'block'
    controls.statusOutput.style.color = '#a52020'
    controls.statusOutput.textContent = 'Enter one or more card IDs first.'
    return
  }

  const cardIds = rawCardIds.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean)
  const payload = {
    templateId,
    cardIds,
    cardRef: rawCardIds
  }
  if (rawChaseCardId) {
    payload.chaseCardId = rawChaseCardId
    payload.chaseCardRef = rawChaseCardId
  }

  try {
    controls.draftOutput.textContent = 'Preparing submit dry run...'
    const res = await fetchBackend('/catalog/listing-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data?.error || 'Failed to prepare listing draft for submit check')
    }

    const replacements = []
    const sanitizedPreview = {
      ok: true,
      dryRun: true,
      pausedBeforeSubmit: true,
      message: 'Live eBay submission is disabled during regression testing.',
      template: sanitizeSubmitPayload(data?.template || {}, 'template', replacements),
      listing: sanitizeSubmitPayload(data?.listing || {}, 'listing', replacements),
      source: sanitizeSubmitPayload(payload, 'source', replacements)
    }

    const replacedFields = uniqueValues(replacements)
    sanitizedPreview.replacedFields = replacedFields
    sanitizedPreview.replacedCount = replacedFields.length

    controls.draftOutput.textContent = JSON.stringify(sanitizedPreview, null, 2)
    controls.statusOutput.style.display = 'block'
    controls.statusOutput.style.color = '#3f4f8e'
    controls.statusOutput.textContent = replacedFields.length
      ? `Submission paused before eBay submit. Auto-filled ${replacedFields.length} blank/null field(s) with "${LISTING_SAFE_PLACEHOLDER}".`
      : 'Submission paused before eBay submit. No blank/null fields detected in the submit payload.'
  } catch (err) {
    controls.draftOutput.textContent = `Submit failed: ${err.message || 'Unknown error'}`
    controls.statusOutput.style.display = 'block'
    controls.statusOutput.style.color = '#a52020'
    controls.statusOutput.textContent = `Submit failed: ${err.message || 'Unknown error'}`
  }
}

function cancelListingDraftBuild() {
  const controls = getListingUiControls()
  if (controls.cardIdInput) controls.cardIdInput.value = ''
  if (controls.chaseCardInput) controls.chaseCardInput.value = ''
  if (controls.draftOutput) controls.draftOutput.textContent = LISTING_DRAFT_DEFAULT_MESSAGE
  controls.statusOutput.style.display = 'block'
  controls.statusOutput.style.color = '#3f4f8e'
  controls.statusOutput.textContent = 'Draft changes discarded. Ready to build a new draft.'
}

async function verifyEbayFieldCoverage() {
  try {
    const sport = encodeURIComponent(activeSport())
    const res = await fetchBackend(`/inventory/ebay/coverage?sport=${sport}`)
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data?.error || 'Failed to verify eBay fields')
    }

    const mapped = Number(data?.mappedColumns || 0)
    const total = Number(data?.totalColumns || 0)
    const required = Number(data?.requiredColumns || 0)
    const missingRequired = Array.isArray(data?.missingRequiredMappings) ? data.missingRequiredMappings : []

    if (missingRequired.length) {
      showInventoryStatus(`eBay field check: mapped ${mapped}/${total}. Missing required mappings: ${missingRequired.join(', ')}`, true)
      return
    }

    showInventoryStatus(`eBay field check: mapped ${mapped}/${total} columns. Required columns covered: ${required}/${required}.`)
  } catch (err) {
    showInventoryStatus(`eBay field check failed: ${err.message || 'Unknown error'}`, true)
  }
}

async function exportInventoryEbayCsv() {
  try {
    const sport = encodeURIComponent(activeSport())
    const res = await fetchBackend(`/inventory/export/ebay-template.csv?sport=${sport}`)

    if (!res.ok) {
      let errorText = 'Failed to export eBay CSV'
      try {
        const data = await res.json()
        if (data?.error) errorText = data.error
      } catch {
        // Keep fallback text if error response is not JSON.
      }
      throw new Error(errorText)
    }

    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition') || ''
    const match = disposition.match(/filename="?([^";]+)"?/i)
    const filename = match?.[1] || `ebay-template-${activeSport().toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)

    showInventoryStatus(`Downloaded eBay template CSV for ${activeSport()}.`)
  } catch (err) {
    showInventoryStatus(`eBay export failed: ${err.message || 'Unknown error'}`, true)
  }
}

async function saveCurrentRowsToInventory() {
  const rows = [...tableBody.querySelectorAll('tr')]
  if (!rows.length) {
    const aiStatus = document.getElementById('aiStatus')
    aiStatus.style.display = 'block'
    aiStatus.style.color = '#b00'
    aiStatus.textContent = 'No scanned rows to save yet.'
    return
  }

  try {
    const payload = {
      sport: activeSport(),
      cards: rows.map((row) => collectRowData(row))
    }

    const res = await fetchBackend('/inventory/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data?.error || 'Failed to save inventory')
    }

    await refreshCommittedSkuCounterFromInventory()

    // Clear scanned rows after a successful commit to inventory.
    rows.forEach((row) => {
      revokeRowPreviewUrls(row)
      row.remove()
    })
    clearScanDraftSnapshot()
    updatePickFromOptions()
    if (typeof window.requestTableAutoSize === 'function') {
      window.requestTableAutoSize()
    }

    const aiStatus = document.getElementById('aiStatus')
    aiStatus.style.display = 'block'
    aiStatus.style.color = '#1c7c2e'
    const attemptPart = data?.importAttemptId ? ` Import ID: ${data.importAttemptId}.` : ''
    aiStatus.textContent = `Saved to ${payload.sport} inventory: ${data.inserted || 0} new, ${data.updated || 0} updated.${attemptPart}`
  } catch (err) {
    const aiStatus = document.getElementById('aiStatus')
    aiStatus.style.display = 'block'
    aiStatus.style.color = '#b00'
    aiStatus.textContent = `Save to inventory failed: ${err.message || 'Unknown error'}`
    console.error('Inventory save failed:', err)
  }
}

function initAppNavigation() {
  const savedSport = localStorage.getItem(ACTIVE_SPORT_KEY)
  if (sportSelect) {
    if (savedSport && [...sportSelect.options].some(o => o.value === savedSport)) {
      sportSelect.value = savedSport
    }

    sportSelect.addEventListener('change', () => {
      localStorage.setItem(ACTIVE_SPORT_KEY, sportSelect.value)
      updateOpenChecklistButtonState()
      renderPrefillHistoryOptions()
      loadCatalogSetOptions().catch(() => {})
      if (inventoryPage?.classList.contains('active')) {
        loadInventory()
      } else if (pricingPage?.classList.contains('active')) {
        loadInventory().then(() => refreshPricingEstimates(inventoryRowsCache, { force: true }))
      } else if (checklistPage?.classList.contains('active')) {
        loadChecklistCatalogData().catch(() => {})
      }
    })
  }

  initScanCommandRibbon()

  navHomeBtn?.addEventListener('click', () => setActivePage('home'))
  navScanBtn?.addEventListener('click', () => setActivePage('scan'))
  navInventoryBtn?.addEventListener('click', async () => {
    setActivePage('inventory')
    await loadListingTemplates()
    await loadInventory()
  })
  navPricingBtn?.addEventListener('click', async () => {
    await openPricingAndAnalyze()
  })
  navListingsBtn?.addEventListener('click', async () => {
    setActivePage('listings')
    await loadListingTemplates()
    await loadInventory()
  })
  navChecklistBtn?.addEventListener('click', async () => {
    setActivePage('checklist')
    await loadChecklistCatalogData()
  })
  navProfileBtn?.addEventListener('click', async () => {
    setActivePage('profile')
    await ensureAuthProviders()
    await loadCurrentUserSession({ quiet: true })
  })
  accountProfileBtn?.addEventListener('click', async () => {
    setActivePage('profile')
    await ensureAuthProviders()
    await loadCurrentUserSession({ quiet: true })
  })

  homeGoScanBtn?.addEventListener('click', () => setActivePage('scan'))
  homeGoInventoryBtn?.addEventListener('click', async () => {
    setActivePage('inventory')
    await loadListingTemplates()
    await loadInventory()
  })

  refreshInventoryBtn?.addEventListener('click', loadInventory)
  openPricingAnalyzeBtn?.addEventListener('click', async () => {
    await openPricingAndAnalyze()
  })
  refreshListingsBtn?.addEventListener('click', async () => {
    await loadListingTemplates()
    await loadInventory()
  })
  loadPricingToListingsBtn?.addEventListener('click', async () => {
    setActivePage('listings')
    await loadListingTemplates()
    await loadInventory()
    if (listingDraftOutput) listingDraftOutput.textContent = 'Use priced inventory IDs here to build or submit a listing draft.'
    showListingStatus('Loaded the current inventory into Listings.')
  })
  rescanListingsBtn?.addEventListener('click', async () => {
    await rescanWorkspaceData('pricing')
    setActivePage('listings')
    await loadListingTemplates()
    await loadInventory()
  })
  rescanScanBtn?.addEventListener('click', async () => {
    await rescanWorkspaceData('scan')
  })
  rescanInventoryBtn?.addEventListener('click', async () => {
    await rescanWorkspaceData('inventory')
  })
  rescanPricingBtn?.addEventListener('click', async () => {
    await rescanWorkspaceData('pricing')
  })
  refreshPricingBtn?.addEventListener('click', async () => {
    await openPricingAndAnalyze()
  })
  saveInventoryBtn?.addEventListener('click', saveCurrentRowsToInventory)
  verifyEbayFieldsBtn?.addEventListener('click', verifyEbayFieldCoverage)
  exportEbayCsvBtn?.addEventListener('click', exportInventoryEbayCsv)
  clearSportInventoryBtn?.addEventListener('click', () => clearInventory('sport'))
  clearAllInventoryBtn?.addEventListener('click', () => clearInventory('all'))
  closeInventoryDetailModalBtn?.addEventListener('click', closeInventoryDetailModal)
  cancelInventoryDetailBtn?.addEventListener('click', closeInventoryDetailModal)
  saveInventoryDetailBtn?.addEventListener('click', () => {
    saveInventoryDetailModalChanges().catch(() => {})
  })
  inventoryDetailModal?.addEventListener('click', (event) => {
    if (event.target === inventoryDetailModal) closeInventoryDetailModal()
  })
  buildListingDraftBtn?.addEventListener('click', buildListingDraftFromInventory)
  submitListingDraftBtn?.addEventListener('click', submitListingDraftToStorefront)
  cancelListingDraftBtn?.addEventListener('click', cancelListingDraftBuild)
  listingsBuildListingDraftBtn?.addEventListener('click', buildListingDraftFromInventory)
  listingsSubmitListingDraftBtn?.addEventListener('click', submitListingDraftToStorefront)
  listingsCancelListingDraftBtn?.addEventListener('click', cancelListingDraftBuild)
  helpMenuToggle?.addEventListener('click', (event) => {
    event.stopPropagation()
    const nextState = !helpMenuDropdown?.classList.contains('active')
    if (helpMenuDropdown) {
      helpMenuDropdown.classList.toggle('active', nextState)
    }
    helpMenuToggle.setAttribute('aria-expanded', nextState ? 'true' : 'false')
  })
  openFeedbackBtn?.addEventListener('click', () => openFeedbackModal('feedback'))
  openDefectBtn?.addEventListener('click', () => openFeedbackModal('defect'))
  closeFeedbackModal?.addEventListener('click', closeFeedbackDialog)
  cancelFeedbackBtn?.addEventListener('click', closeFeedbackDialog)
  submitFeedbackBtn?.addEventListener('click', submitFeedbackReport)
  signupSubmitBtn?.addEventListener('click', submitSignup)
  loginSubmitBtn?.addEventListener('click', submitLogin)
  googleLoginBtn?.addEventListener('click', () => startGoogleOAuth('login'))
  showForgotPasswordLink?.addEventListener('click', (event) => {
    event.preventDefault()
    setAuthPortalView('reset')
  })
  showSignupLink?.addEventListener('click', (event) => {
    event.preventDefault()
    if (rememberMeSignupCheckbox && rememberMeCheckbox) {
      rememberMeSignupCheckbox.checked = Boolean(rememberMeCheckbox.checked)
    }
    setAuthPortalView('signup')
  })
  backToLoginFromSignupLink?.addEventListener('click', (event) => {
    event.preventDefault()
    if (rememberMeSignupCheckbox && rememberMeCheckbox) {
      rememberMeCheckbox.checked = Boolean(rememberMeSignupCheckbox.checked)
    }
    setAuthPortalView('login')
  })
  backToLoginFromResetLink?.addEventListener('click', (event) => {
    event.preventDefault()
    setAuthPortalView('login')
  })
  findAccountBtn?.addEventListener('click', findAccountForSignin)
  resetPasswordBtn?.addEventListener('click', resetPasswordForSignin)
  saveProfileBtn?.addEventListener('click', saveProfileSettings)
  logoutBtn?.addEventListener('click', logoutCurrentUser)
  googleLinkBtn?.addEventListener('click', () => startGoogleOAuth('link'))
  saveConnectionBtn?.addEventListener('click', saveConnectionSettings)
  resetConnectionFormBtn?.addEventListener('click', () => {
    resetConnectionForm(String(profileConnectionProviderSelect?.value || 'ebay'))
    showProfileStatus('Connection form reset.')
  })
  checklistViewTabBtn?.addEventListener('click', () => setChecklistView('checklist'))
  oddsViewTabBtn?.addEventListener('click', () => setChecklistView('odds'))
  refreshChecklistCatalogBtn?.addEventListener('click', async () => {
    await loadChecklistCatalogData()
  })
  checklistYearFilter?.addEventListener('change', () => {
    loadChecklistCatalogData().catch(() => {})
  })
  checklistSetSearchInput?.addEventListener('input', () => {
    loadChecklistCatalogData({ quiet: true }).catch(() => {})
  })
  checklistSearchInput?.addEventListener('input', () => {
    if (!activeChecklistSetId) return
    loadChecklistSetDetail({ quiet: true }).catch(() => {})
  })
  checklistRookieFilter?.addEventListener('change', () => {
    if (!activeChecklistSetId) return
    renderChecklistTable(checklistCardsCache)
  })
  checklistCustomSortField?.addEventListener('change', () => {
    const key = String(checklistCustomSortField?.value || '').trim() || 'cardNumber'
    checklistSortState = {
      key,
      direction: String(checklistCustomSortDirection?.value || checklistSortState?.direction || 'asc')
    }
    renderChecklistTable(checklistCardsCache)
  })
  checklistCustomSortDirection?.addEventListener('change', () => {
    checklistSortState = {
      key: String(checklistCustomSortField?.value || checklistSortState?.key || 'cardNumber').trim(),
      direction: String(checklistCustomSortDirection?.value || 'asc').trim()
    }
    renderChecklistTable(checklistCardsCache)
  })
  checklistCustomFilterField?.addEventListener('change', () => {
    if (!activeChecklistSetId) return
    renderChecklistTable(checklistCardsCache)
  })
  checklistCustomFilterOperator?.addEventListener('change', () => {
    if (!activeChecklistSetId) return
    renderChecklistTable(checklistCardsCache)
  })
  checklistCustomFilterValue?.addEventListener('input', () => {
    if (!activeChecklistSetId) return
    renderChecklistTable(checklistCardsCache)
  })
  checklistCustomFilterClearBtn?.addEventListener('click', () => {
    if (checklistCustomFilterField) checklistCustomFilterField.value = ''
    if (checklistCustomFilterOperator) checklistCustomFilterOperator.value = 'contains'
    if (checklistCustomFilterValue) checklistCustomFilterValue.value = ''
    if (!activeChecklistSetId) return
    renderChecklistTable(checklistCardsCache)
  })
  checklistOddsCategoryFilter?.addEventListener('input', () => {
    if (!activeChecklistSetId) return
    loadChecklistSetDetail({ quiet: true }).catch(() => {})
  })
  refreshChecklistSetDetailBtn?.addEventListener('click', () => {
    if (!activeChecklistSetId) return
    loadChecklistSetDetail().catch(() => {})
  })
  closeChecklistSetModalBtn?.addEventListener('click', closeChecklistSetModal)
  checklistSetModal?.addEventListener('click', (event) => {
    if (event.target === checklistSetModal) {
      closeChecklistSetModal()
    }
  })
  closeChecklistOwnedCardModalBtn?.addEventListener('click', () => {
    closeChecklistOwnedCardModal({ confirmed: false, details: null })
  })
  cancelChecklistOwnedCardBtn?.addEventListener('click', () => {
    closeChecklistOwnedCardModal({ confirmed: false, details: null })
  })
  saveChecklistOwnedCardBtn?.addEventListener('click', () => {
    const details = collectChecklistOwnedCardInput()
    if (!details.sku) {
      showChecklistStatus('SKU is required before adding owned card to inventory.', true)
      return
    }
    if (!Number.isFinite(details.quantity) || details.quantity < 1) {
      showChecklistStatus('Quantity must be at least 1 before adding owned card to inventory.', true)
      return
    }
    closeChecklistOwnedCardModal({ confirmed: true, details })
  })
  checklistOwnedCardModal?.addEventListener('click', (event) => {
    if (event.target === checklistOwnedCardModal) {
      closeChecklistOwnedCardModal({ confirmed: false, details: null })
    }
  })
  checklistDataBody?.addEventListener('change', (event) => {
    const target = event?.target
    if (!target?.classList?.contains('checklist-owned-checkbox')) return
    handleChecklistOwnedToggleChange(event).catch(() => {})
  })
  closeChecklistImportProfileModalBtn?.addEventListener('click', () => {
    closeChecklistImportProfileDialog({ confirmed: false, profile: null })
  })
  cancelChecklistImportProfileBtn?.addEventListener('click', () => {
    closeChecklistImportProfileDialog({ confirmed: false, profile: null })
  })
  saveChecklistImportProfileBtn?.addEventListener('click', () => {
    const profile = collectChecklistImportProfileInput()
    if (!profile.setName) {
      showChecklistStatus('Import profile requires a set name before ingest.', true)
      return
    }
    if (!profile.year) {
      showChecklistStatus('Import profile requires a year before ingest.', true)
      return
    }
    if (!profile.manufacturer) {
      showChecklistStatus('Import profile requires a manufacturer before ingest.', true)
      return
    }

    saveChecklistImportProfile(profile)
    closeChecklistImportProfileDialog({ confirmed: true, profile })
  })
  checklistImportProfileModal?.addEventListener('click', (event) => {
    if (event.target === checklistImportProfileModal) {
      closeChecklistImportProfileDialog({ confirmed: false, profile: null })
    }
  })
  checklistSortHeaders.forEach((header) => {
    header.addEventListener('click', () => {
      toggleChecklistSort(header?.dataset?.sortKey)
    })
  })
  oddsSortHeaders.forEach((header) => {
    header.addEventListener('click', () => {
      toggleOddsSort(header?.dataset?.sortKey)
    })
  })
  checklistViewTabBtn?.addEventListener('click', () => {
    if (!activeChecklistSetId) return
    loadChecklistSetDetail({ quiet: true }).catch(() => {})
  })
  oddsViewTabBtn?.addEventListener('click', () => {
    if (!activeChecklistSetId) return
    loadChecklistSetDetail({ quiet: true }).catch(() => {})
  })
  checklistChooseFileBtn?.addEventListener('click', () => {
    checklistImportFile?.click()
  })
  oddsChooseFileBtn?.addEventListener('click', () => {
    oddsImportFile?.click()
  })
  checklistImportFile?.addEventListener('change', (event) => {
    const file = event?.target?.files?.[0] || null
    selectedChecklistFile = file
    showChecklistStatus(file ? `Selected checklist file: ${file.name}` : 'Checklist file selection cleared.')
  })
  oddsImportFile?.addEventListener('change', (event) => {
    const file = event?.target?.files?.[0] || null
    selectedOddsFile = file
    showChecklistStatus(file ? `Selected odds file: ${file.name}` : 'Odds file selection cleared.')
  })
  checklistImportBtn?.addEventListener('click', importChecklistRows)
  oddsImportBtn?.addEventListener('click', importOddsRows)
  checklistImportUrlBtn?.addEventListener('click', importChecklistFromUrl)
  oddsImportUrlBtn?.addEventListener('click', importOddsFromUrl)
  checklistImportUrl?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    importChecklistFromUrl().catch(() => {})
  })
  oddsImportUrl?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    importOddsFromUrl().catch(() => {})
  })
  openToppsChecklistBtn?.addEventListener('click', () => {
    window.open('https://www.topps.com/pages/checklists', '_blank', 'noopener')
  })
  openToppsOddsBtn?.addEventListener('click', () => {
    window.open('https://www.topps.com/pages/odds', '_blank', 'noopener')
  })
  syncOpenChecklistBtn?.addEventListener('click', () => {
    syncOpenChecklistPopularSets().catch(() => {})
  })
  profileConnectionProviderSelect?.addEventListener('change', () => {
    editingConnectionProviderSlug = ''
    toggleCustomProviderRow()
    populateConnectionAuthTypeOptions()
  })
  profileCustomProviderInput?.addEventListener('input', () => {
    if (editingConnectionProviderSlug && String(profileConnectionProviderSelect?.value || '') === 'other') {
      editingConnectionProviderSlug = currentConnectionFormSlug()
    }
  })
  signupPasswordInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitSignup()
  })
  loginPasswordInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitLogin()
  })

  document.addEventListener('click', (event) => {
    if (!helpMenuDropdown?.classList.contains('active')) return
    if (event.target === helpMenuToggle || helpMenuToggle?.contains(event.target)) return
    if (helpMenuDropdown?.contains(event.target)) return
    closeHelpMenu()
  })

  renderProfileUi()
  setChecklistView('checklist')
  updateOpenChecklistButtonState()
  initializeAppBadge()
}

function parseSkuNumber(value) {
  const raw = String(value || '').trim()
  if (!raw) return 0
  const match = raw.match(/(\d{1,10})$/)
  if (!match) return 0
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : 0
}

function getCommittedSkuCounter() {
  const value = Number(localStorage.getItem(scopedStorageKey(SKU_COMMITTED_COUNTER_KEY)) || '0')
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function setCommittedSkuCounter(value) {
  const safe = Math.max(0, Math.round(Number(value) || 0))
  localStorage.setItem(scopedStorageKey(SKU_COMMITTED_COUNTER_KEY), String(safe))
}

function getMaxSkuFromCurrentTable() {
  let maxSku = 0
  const rows = [...tableBody.querySelectorAll('tr')]
  rows.forEach((row) => {
    const input = row.querySelector('.sku')
    const skuNumber = parseSkuNumber(input?.value)
    if (skuNumber > maxSku) maxSku = skuNumber
  })
  return maxSku
}

function beginSkuSession() {
  if (forceSkuResetOnNextImport) {
    skuSessionCursor = 1
    forceSkuResetOnNextImport = false
    return
  }

  const baseCounter = Math.max(getCommittedSkuCounter(), getMaxSkuFromCurrentTable())
  skuSessionCursor = baseCounter + 1
}

function endSkuSession() {
  skuSessionCursor = null
}

async function refreshCommittedSkuCounterFromInventory() {
  try {
    const res = await fetchBackend('/inventory')
    if (!res.ok) return
    const data = await res.json()
    const items = Array.isArray(data?.items) ? data.items : []
    let maxSku = 0
    items.forEach((item) => {
      const skuNumber = parseSkuNumber(item?.sku)
      if (skuNumber > maxSku) maxSku = skuNumber
    })
    setCommittedSkuCounter(maxSku)
  } catch (err) {
    console.warn('Could not refresh committed SKU counter from inventory', err)
  }
}

function nextSku() {
  if (!Number.isFinite(skuSessionCursor) || skuSessionCursor === null) {
    beginSkuSession()
  }
  const next = skuSessionCursor
  skuSessionCursor += 1
  return `SKU-${String(next).padStart(6, '0')}`
}

function renderViewerTransform() {
  if (!imageViewerImg) return
  imageViewerImg.style.transform = `translate(${viewerOffsetX}px, ${viewerOffsetY}px) scale(${viewerScale})`
}

function resetViewerTransform() {
  viewerScale = 1
  viewerOffsetX = 0
  viewerOffsetY = 0
  renderViewerTransform()
}

function clampViewerScale(nextScale) {
  return Math.min(6, Math.max(1, nextScale))
}

function zoomViewer(multiplier) {
  const next = clampViewerScale(viewerScale * multiplier)
  viewerScale = next
  if (viewerScale === 1) {
    viewerOffsetX = 0
    viewerOffsetY = 0
  }
  renderViewerTransform()
}

function collectViewerItems() {
  const items = []
  const rows = [...tableBody.querySelectorAll('tr')]
  rows.forEach((row, rowIndex) => {
    const images = [...row.querySelectorAll('img.preview')]
    images.forEach((img) => {
      const label = img.closest('.preview-wrap')?.querySelector('.preview-tag')?.textContent || 'Card Image'
      items.push({
        src: img.src,
        caption: `Card ${rowIndex + 1} - ${label}`,
        element: img
      })
    })
  })
  return items
}

function showViewerIndex(index) {
  if (!viewerItems.length || !imageViewerImg) return
  const safe = ((index % viewerItems.length) + viewerItems.length) % viewerItems.length
  viewerIndex = safe
  const item = viewerItems[safe]
  imageViewerImg.src = item.src
  imageViewerCaption.textContent = item.caption
  resetViewerTransform()
  if (imageViewerStage) {
    imageViewerStage.classList.toggle('can-navigate', viewerScale <= 1)
  }
}

function openImageViewerFromElement(img) {
  viewerItems = collectViewerItems()
  viewerIndex = viewerItems.findIndex(item => item.element === img)
  if (viewerIndex < 0) viewerIndex = 0
  imageViewerModal.classList.add('active')
  showViewerIndex(viewerIndex)
}

function showPrevImage() {
  if (!viewerItems.length) return
  showViewerIndex(viewerIndex - 1)
}

function showNextImage() {
  if (!viewerItems.length) return
  showViewerIndex(viewerIndex + 1)
}

if (!dropZone) console.warn('dropZone element not found')
if (!fileInput) console.warn('fileInput element not found')
if (!tableBody) console.warn('tableBody element not found')
if (!aiToggle) console.warn('aiToggle element not found')

function startProgress(label, total) {
  if (!taskProgress) return
  taskProgress.style.display = 'block'
  taskProgressLabel.textContent = label
  taskProgressCount.textContent = `0 / ${total}`
  taskProgressBar.style.width = '0%'
  taskProgressMessage.textContent = 'Starting...'
  keepProgressInView()
}

function setProgressCancel(handler) {
  progressCancelHandler = handler || null
  if (!taskProgressCancel) return
  taskProgressCancel.style.display = progressCancelHandler ? 'inline-block' : 'none'
  taskProgressCancel.disabled = false
}

if (taskProgressCancel) {
  taskProgressCancel.addEventListener('click', () => {
    if (!progressCancelHandler) return
    progressCancelHandler()
  })
}

function keepProgressInView() {
  void taskProgress
}

function updateProgress(current, total, message) {
  if (!taskProgress) return
  const safeTotal = Math.max(total, 1)
  const pct = Math.min(100, Math.round((current / safeTotal) * 100))
  taskProgressCount.textContent = `${current} / ${safeTotal}`
  taskProgressBar.style.width = `${pct}%`
  if (message) taskProgressMessage.textContent = message
  keepProgressInView()
}

function finishProgress(message = 'Done') {
  if (!taskProgress) return
  taskProgressBar.style.width = '100%'
  taskProgressMessage.textContent = message
  setProgressCancel(null)
  keepProgressInView()
  setTimeout(() => {
    taskProgress.style.display = 'none'
  }, 1200)
}

function openImageViewer(src, caption = '') {
  if (!imageViewerModal || !imageViewerImg) return
  imageViewerModal.classList.add('active')
  viewerItems = [{ src, caption: caption || 'Card Image', element: null }]
  viewerIndex = 0
  showViewerIndex(0)
}

function closeImageViewer() {
  if (!imageViewerModal || !imageViewerImg) return
  imageViewerModal.classList.remove('active')
  imageViewerImg.src = ''
  imageViewerCaption.textContent = ''
  viewerItems = []
  viewerIndex = -1
  if (imageViewerStage) imageViewerStage.classList.remove('dragging')
  isViewerDragging = false
  resetViewerTransform()
}

if (imageViewerClose) {
  imageViewerClose.addEventListener('click', closeImageViewer)
}

if (imageViewerModal) {
  imageViewerModal.addEventListener('click', (e) => {
    if (e.target === imageViewerModal) {
      closeImageViewer()
    }
  })
}

if (imageZoomIn) {
  imageZoomIn.addEventListener('click', () => zoomViewer(1.25))
}

if (imageZoomOut) {
  imageZoomOut.addEventListener('click', () => zoomViewer(0.8))
}

if (imageZoomReset) {
  imageZoomReset.addEventListener('click', () => resetViewerTransform())
}

if (imagePrev) {
  imagePrev.addEventListener('click', showPrevImage)
}

if (imageNext) {
  imageNext.addEventListener('click', showNextImage)
}

if (imageViewerStage) {
  imageViewerStage.addEventListener('wheel', (e) => {
    e.preventDefault()
    if (e.deltaY < 0) zoomViewer(1.1)
    else zoomViewer(0.9)
  }, { passive: false })

  imageViewerStage.addEventListener('mousedown', (e) => {
    if (viewerScale <= 1) return
    isViewerDragging = true
    dragStartX = e.clientX - viewerOffsetX
    dragStartY = e.clientY - viewerOffsetY
    imageViewerStage.classList.add('dragging')
  })

  window.addEventListener('mousemove', (e) => {
    if (!isViewerDragging) return
    viewerOffsetX = e.clientX - dragStartX
    viewerOffsetY = e.clientY - dragStartY
    renderViewerTransform()
  })

  window.addEventListener('mouseup', () => {
    if (!isViewerDragging) return
    isViewerDragging = false
    imageViewerStage.classList.remove('dragging')
  })

  imageViewerStage.addEventListener('click', (e) => {
    if (viewerScale > 1) return
    const rect = imageViewerStage.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < rect.width / 2) showPrevImage()
    else showNextImage()
  })
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && imageViewerModal?.classList.contains('active')) {
    closeImageViewer()
  }
  if (e.key === 'ArrowLeft' && imageViewerModal?.classList.contains('active')) {
    showPrevImage()
  }
  if (e.key === 'ArrowRight' && imageViewerModal?.classList.contains('active')) {
    showNextImage()
  }
})
async function resolveBackendUrl() {
  const isLocalhost = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(String(window.location?.hostname || ''))
  const isHosted = typeof window !== 'undefined'
    && /^https?:/i.test(String(window.location?.protocol || ''))
    && !isLocalhost

  // Step 1: Check explicit backend URL in config.json first for hosted deployments.
  try {
    const res = await fetch('config.json')
    if (res.ok) {
      const cfg = await res.json()
      if (cfg.backendUrl && cfg.backendUrl.trim()) {
        const configured = String(cfg.backendUrl).trim()
        try {
          const health = await fetch(`${configured}/health`, { method: 'GET' })
          if (health.ok) {
            console.log(`[Backend] Using URL from config.json: ${configured}`)
            return configured
          }
        } catch {
          // If health check fails, continue to additional fallbacks.
        }
      }
    }
  } catch (err) {
    // config.json not found or parse error; continue to next method
  }

  // Step 2: For local development, prefer the current origin or localhost probes.
  if (isLocalhost) {
    if (typeof window !== 'undefined' && /^https?:/i.test(String(window.location?.origin || ''))) {
      try {
        const res = await fetch(`${window.location.origin}/health`, { method: 'GET' })
        if (res.ok) {
          console.log(`[Backend] Using local origin: ${window.location.origin}`)
          return window.location.origin
        }
      } catch (err) {
        // Fall through to localhost probes.
      }
    }

    for (const port of BACKEND_PORTS) {
      const url = `http://localhost:${port}`
      try {
        const res = await fetch(`${url}/health`, { method: 'GET' })
        if (res.ok) {
          console.log(`[Backend] Found on localhost:${port}`)
          return url
        }
      } catch (err) {
        // ignore and try next port
      }
    }
  }

  // Step 3: Probe localhost ports when running non-hosted surfaces
  // (for LAN/file-hosted frontend talking to a local backend).
  if (!isHosted) {
    for (const port of BACKEND_PORTS) {
      const url = `http://localhost:${port}`
      try {
        const res = await fetch(`${url}/health`, { method: 'GET' })
        if (res.ok) {
          console.log(`[Backend] Found on localhost:${port}`)
          return url
        }
      } catch (err) {
        // ignore and continue
      }
    }
  }

  // Step 4: For HTTPS deployments, try same origin (backend on same host/port)
  if (typeof window !== 'undefined' && /^https?:/i.test(String(window.location?.origin || ''))) {
    try {
      const res = await fetch(`${window.location.origin}/health`, { method: 'GET' })
      if (res.ok) {
        console.log(`[Backend] Using same origin: ${window.location.origin}`)
        return window.location.origin
      }
    } catch (err) {
      // Fall back to localhost probes for local development.
    }
  }

  // Step 5: Local development fallback - probe localhost ports
  if (!isHosted) {
    for (const port of BACKEND_PORTS) {
      const url = `http://localhost:${port}`
      try {
        const res = await fetch(`${url}/health`, { method: "GET" })
        if (res.ok) {
          console.log(`[Backend] Found on localhost:${port}`)
          return url
        }
      } catch (err) {
        // ignore and try next port
      }
    }
  }

  if (isHosted) {
    throw new Error('Hosted frontend could not resolve backend URL from config.json or same-origin health.')
  }

  throw new Error(`Unable to reach backend on ports: ${BACKEND_PORTS.join(", ")}`)
}

async function getBackendUrl() {
  if (!BACKEND_URL) {
    BACKEND_URL = await resolveBackendUrl()
  }
  return BACKEND_URL
}

async function checkAiConfig() {
  try {
    const backendUrl = await getBackendUrl()
    const res = await fetch(`${backendUrl}/config`)
    if (!res.ok) return
    const cfg = await res.json()
    const provider = String(cfg?.aiProvider || 'azure').toLowerCase()
    const aiStatus = document.getElementById('aiStatus')
    const aiToggle = document.getElementById('aiToggle')
    if (cfg.aiEnabled) {
      aiStatus.style.display = 'none'
      aiToggle.disabled = false
    } else if (cfg.mockEnabled) {
      aiStatus.style.display = 'block'
      aiStatus.textContent = 'AI extraction running in MOCK mode (no Azure key).'
      aiToggle.disabled = false
    } else {
      aiStatus.style.display = 'block'
      if (provider === 'cardsight') {
        aiStatus.textContent = 'AI extraction is disabled - set CARDSIGHT_API_KEY in backend .env to enable.'
      } else if (provider === 'hybrid') {
        aiStatus.textContent = 'AI extraction is disabled - set AZURE_API_KEY and/or CARDSIGHT_API_KEY in backend .env to enable.'
      } else {
        aiStatus.textContent = 'AI extraction is disabled - set AZURE_API_KEY in backend .env to enable.'
      }
      aiToggle.disabled = true
    }
  } catch (err) {
    console.warn('Could not fetch backend config', err)
  }
}

// Check AI config on load
getBackendUrl().then(() => checkAiConfig()).catch(() => {})
initAppNavigation()
setActivePage('profile')
ensureAuthProviders().catch(() => {})
loadCurrentUserSession({ quiet: true })
  .then(() => {
    setActivePage(getInitialActivePage())
  })
  .catch(() => {
    setActivePage('profile')
  })
loadCatalogSetOptions().catch(() => {})
loadListingTemplates().catch(() => {})
loadInventory().catch(() => {})
loadChecklistCatalogData({ quiet: true }).catch(() => {})
renderPrefillHistoryOptions()
renderYearChecklist()
refreshCommittedSkuCounterFromInventory()
reduceBrowserAutocompleteNoise()
restoreScanDraftSnapshot()

function bindUploadDropZone(zone) {
  if (!zone) return

  ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
    zone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
    });
  })

  zone.addEventListener("dragover", () => {
    zone.classList.add("highlight");
  })

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("highlight");
  })

  zone.addEventListener("drop", e => {
    zone.classList.remove("highlight");
    const files = [...e.dataTransfer.files];
    queueFilesForImport(files)
  })

  zone.addEventListener("click", (e) => {
    if (e.target.closest('button, label')) return
    e.preventDefault();
    e.stopPropagation();
    triggerFilePicker()
  })
}

bindUploadDropZone(dropZone)
bindUploadDropZone(quickAddDropZone)

// Explicit choose files button (visible) to open file picker
const chooseFilesBtn = document.getElementById('chooseFilesBtn');
if (chooseFilesBtn) {
  chooseFilesBtn.addEventListener('click', (e) => {
    e.preventDefault();
    triggerFilePicker()
  });
}
quickAddFilesBtn?.addEventListener('click', (e) => {
  e.preventDefault()
  triggerFilePicker()
})
prefillTeamInput?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return
  e.preventDefault()
  commitPendingPrefillInput('team')
})
prefillSetInput?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return
  e.preventDefault()
  commitPendingPrefillInput('set')
})
clearPrefillSetsBtn?.addEventListener('click', () => clearPrefillHistory('set'))
if (fileInput) {
  fileInput.addEventListener("change", e => {
    const files = [...e.target.files]
    queueFilesForImport(files)
    fileInput.value = ''
  });
}

cancelImportPrefillBtn?.addEventListener('click', () => {
  updateQueuedFileFeedback([])
  closeImportPrefillDialog()
})
importPrefillModal?.addEventListener('click', (e) => {
  if (e.target === importPrefillModal) {
    updateQueuedFileFeedback([])
    closeImportPrefillDialog()
  }
})
feedbackModal?.addEventListener('click', (e) => {
  if (e.target === feedbackModal) {
    closeFeedbackDialog()
  }
})
closeImportPrefillModal?.addEventListener('click', () => {
  updateQueuedFileFeedback([])
  closeImportPrefillDialog()
})
confirmImportPrefillBtn?.addEventListener('click', async () => {
  const files = pendingImportFiles.slice()
  if (!files.length) {
    closeImportPrefillDialog()
    return
  }

  const prefill = collectImportPrefill()
  prefill.teams.forEach((value) => savePrefillHistoryValue('team', value))
  prefill.sets.forEach((value) => savePrefillHistoryValue('set', value))
  closeImportPrefillDialog()
  await handleFiles(files, prefill)
})

async function handleFiles(files, prefill = null) {
  const orderedFiles = sortImportedFiles(files)
  console.log('handleFiles called with', orderedFiles);
  await refreshCommittedSkuCounterFromInventory()
  beginSkuSession()
  try {
    sessionStorage.setItem(IMPORT_IN_PROGRESS_KEY, '1')
  } catch {
    // Ignore storage write issues.
  }
  setActivePage('scan')
  const uploadSession = {
    cancelled: false,
    controller: new AbortController()
  }
  currentUploadSession = uploadSession

  const totalPairs = Math.ceil(orderedFiles.length / 2)
  startProgress(aiToggle.checked ? 'Uploading and extracting...' : 'Uploading files...', totalPairs)
  setProgressCancel(() => {
    uploadSession.cancelled = true
    uploadSession.controller.abort()
    if (taskProgressMessage) taskProgressMessage.textContent = 'Cancelling upload...'
    if (taskProgressCancel) taskProgressCancel.disabled = true
  })

  try {
    const pairs = []
    for (let i = 0; i < orderedFiles.length; i += 2) {
      const pairIndex = Math.floor(i / 2) + 1
      const frontFile = orderedFiles[i]
      const backFile = orderedFiles[i + 1] || null
      pairs.push({ pairIndex, frontFile, backFile })
    }

    let completedPairs = 0

    const processPair = async (pair) => {
      if (uploadSession.cancelled) return

      const frontBuffer = await pair.frontFile.arrayBuffer()
      const backBuffer = pair.backFile ? await pair.backFile.arrayBuffer() : null
      if (uploadSession.cancelled) return

      const row = addRow(pair.frontFile, frontBuffer, pair.backFile, backBuffer)
      applyImportPrefillToRow(row, prefill)

      if (aiToggle.checked) {
        if (backBuffer) {
          await runPairedAIExtraction(row, frontBuffer, backBuffer, uploadSession.controller.signal)
        } else {
          await runSingleAIExtraction(row, frontBuffer, uploadSession.controller.signal)
        }
      }

      completedPairs += 1
      const message = aiToggle.checked
        ? `Processed pair ${completedPairs} of ${totalPairs}`
        : `Uploaded pair ${completedPairs}`
      updateProgress(completedPairs, totalPairs, message)

      if (row.isConnected) {
        applyImportPrefillToRow(row, prefill)
      }

      persistScanDraftSnapshot()
    }

    if (!aiToggle.checked) {
      for (const pair of pairs) {
        if (uploadSession.cancelled) break
        await processPair(pair)
      }
    } else {
      let nextIndex = 0
      const workerCount = Math.max(1, Math.min(IMPORT_AI_CONCURRENCY, pairs.length))
      const workers = Array.from({ length: workerCount }, async () => {
        while (!uploadSession.cancelled) {
          const current = nextIndex
          nextIndex += 1
          if (current >= pairs.length) break
          await processPair(pairs[current])
        }
      })
      await Promise.all(workers)
    }

    if (!uploadSession.cancelled) {
      const mergedCount = collapseAllDuplicateRows()
      if (mergedCount > 0) {
        updateProgress(completedPairs, totalPairs, `Merged ${mergedCount} duplicate row${mergedCount === 1 ? '' : 's'} into quantity totals.`)
      }
    }

    finishProgress(uploadSession.cancelled ? 'Upload cancelled.' : (aiToggle.checked ? 'Upload and extraction complete.' : 'Upload complete.'))
  } finally {
    try {
      sessionStorage.removeItem(IMPORT_IN_PROGRESS_KEY)
    } catch {
      // Ignore storage write issues.
    }
    if (currentUploadSession === uploadSession) currentUploadSession = null
    endSkuSession()
    setProgressCancel(null)
    if (typeof window.requestTableAutoSize === 'function') {
      window.requestTableAutoSize()
    }
  }
}

function revokeRowPreviewUrls(row) {
  const urls = Array.isArray(row.previewObjectUrls) ? row.previewObjectUrls : []
  urls.forEach((url) => {
    try {
      URL.revokeObjectURL(url)
    } catch {
      // Ignore malformed or already-revoked URLs.
    }
  })
  row.previewObjectUrls = []
}

function buildPreviewWrapMarkup(row, file, label) {
  if (!file) return ''
  const url = URL.createObjectURL(file)
  row.previewObjectUrls = row.previewObjectUrls || []
  row.previewObjectUrls.push(url)
  return `<div class="preview-wrap"><span class="preview-tag">${label}</span><img class="preview" src="${url}"></div>`
}

function renderRowPreviewCell(row) {
  const previewCell = row.querySelector('td:first-child')
  if (!previewCell) return

  revokeRowPreviewUrls(row)

  const frontMarkup = buildPreviewWrapMarkup(row, row.frontFile, 'Front')
  const backMarkup = buildPreviewWrapMarkup(row, row.backFile, 'Back')
  const hasPair = Boolean(row.frontFile && row.backFile)
  const swapMarkup = hasPair
    ? '<button type="button" class="swapSidesBtn" title="Swap front/back and rescan"><span class="swap-arrows">&lt;-&gt;</span><span class="swap-label">Swap</span></button>'
    : ''

  previewCell.innerHTML = `<div class="preview-stack">${frontMarkup}${swapMarkup}${backMarkup}</div>`

  const previewImages = previewCell.querySelectorAll('img.preview')
  previewImages.forEach((img) => {
    img.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      openImageViewerFromElement(img)
    })
  })

  const swapButton = previewCell.querySelector('.swapSidesBtn')
  if (swapButton) {
    swapButton.disabled = row.dataset.swapBusy === '1'
    swapButton.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      await swapRowFrontBackAndRescan(row)
    })
  }
}

async function swapRowFrontBackAndRescan(row) {
  if (!row || row.dataset.swapBusy === '1') return
  if (!row.frontBuffer || !row.backBuffer) return

  row.dataset.swapBusy = '1'
  renderRowPreviewCell(row)

  try {
    const oldFrontFile = row.frontFile
    const oldFrontBuffer = row.frontBuffer
    row.frontFile = row.backFile
    row.frontBuffer = row.backBuffer
    row.backFile = oldFrontFile
    row.backBuffer = oldFrontBuffer

    const sideInput = row.querySelector('.side')
    if (sideInput) sideInput.value = 'Front+Back Pair'

    renderRowPreviewCell(row)

    startProgress('Swapping front/back and rescanning...', 1)
    updateProgress(1, 1, 'Re-analyzing swapped pair...')

    await runPairedAIExtraction(row, row.frontBuffer, row.backBuffer)

    if (row.isConnected) {
      updatePickFromOptions()
      if (typeof window.requestTableAutoSize === 'function') {
        window.requestTableAutoSize()
      }
    }

    finishProgress('Swap complete. Extraction updated.')
  } catch (err) {
    console.error('Swap/rescan failed:', err)
    finishProgress('Swap applied, but rescan failed.')
  } finally {
    if (row.isConnected) {
      row.dataset.swapBusy = '0'
      renderRowPreviewCell(row)
    }
  }
}

function addRow(frontFile, frontBuffer, backFile = null, backBuffer = null) {
  const row = document.createElement("tr");

  const sideValue = backFile ? 'Front+Back Pair' : (frontFile ? 'Single Image' : '')

  row.innerHTML = `
    <td><div class="preview-stack"></div></td>
    <td><input class="quantity" type="number" min="1" step="1" value="1"></td>
    <td><input class="sku" value="${nextSku()}"></td>
    <td><input class="name"></td>
    <td><input class="team"></td>
    <td><input class="position"></td>
    <td><input class="set"></td>
    <td><input class="year"></td>
    <td><input class="cardNumber"></td>
    <td><input class="parallel"></td>
    <td><select class="rookie"><option>No</option><option>Yes</option></select></td>
    <td><select class="autograph"><option>No</option><option>Yes</option></select></td>
    <td><input class="title"></td>
    <td><input class="description"></td>
    <td><select class="pickFrom"><option value="">Refresh pick options</option></select></td>
    <td><input class="filename"></td>
    <td><input class="pictureUrl"></td>
    <td><input class="side" value="${sideValue}"></td>
    <td><span class="aiMeta">-</span></td>
    <td><button class="deleteRowBtn">X</button></td>
  `;

  row.frontFile = frontFile || null;
  row.frontBuffer = frontBuffer || null;
  row.backFile = backFile || null;
  row.backBuffer = backBuffer || null;
  row.previewObjectUrls = [];
  row.dataset.swapBusy = '0';

  if (typeof window.applyCustomColumnsToRow === 'function') {
    window.applyCustomColumnsToRow(row)
  }

  renderRowPreviewCell(row)

  // Delete row button
  row.querySelector(".deleteRowBtn").addEventListener("click", () => {
    revokeRowPreviewUrls(row)
    row.remove();
    updatePickFromOptions();
    persistScanDraftSnapshot()
  });

  const fieldSelectors = [
    ".team",
    ".set",
    ".name"
  ];

  fieldSelectors.forEach(selector => {
    row.querySelector(selector).addEventListener("input", updatePickFromOptions);
  });

  tableBody.appendChild(row);
  if (typeof window.updateTableColumns === 'function') {
    window.updateTableColumns()
  }
  if (typeof window.requestTableAutoSize === 'function') {
    window.requestTableAutoSize()
  }
  updatePickFromOptions();
  persistScanDraftSnapshot()
  return row;
}

function updatePickFromOptions() {
  const groups = {}

  for (const row of tableBody.querySelectorAll('tr')) {
    const team = row.querySelector('.team').value.trim()
    const set = row.querySelector('.set').value.trim()
    const name = row.querySelector('.name').value.trim()

    if (!team || !set || !name) continue

    const key = `${team}||${set}`
    groups[key] = groups[key] || new Set()
    groups[key].add(name)
  }

  for (const row of tableBody.querySelectorAll('tr')) {
    const team = row.querySelector('.team').value.trim()
    const set = row.querySelector('.set').value.trim()
    const pickFromSelect = row.querySelector('.pickFrom')
    const key = `${team}||${set}`

    const values = groups[key] ? Array.from(groups[key]).sort() : []
    const selectedValue = pickFromSelect.value
    pickFromSelect.innerHTML = ''

    const defaultOption = document.createElement('option')
    defaultOption.value = ''
    defaultOption.textContent = values.length ? 'Select player...' : 'No options'
    pickFromSelect.appendChild(defaultOption)

    for (const value of values) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = value
      pickFromSelect.appendChild(option)
    }

    if (values.includes(selectedValue)) {
      pickFromSelect.value = selectedValue
    }
  }
}

function normalizeDupValue(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function rowDuplicateData(row) {
  const read = (selector) => String(row.querySelector(selector)?.value || '').trim()
  return {
    row,
    nameRaw: read('.name'),
    teamRaw: read('.team'),
    setRaw: read('.set'),
    yearRaw: read('.year'),
    cardRaw: read('.cardNumber'),
    cardDigits: String(read('.cardNumber')).replace(/\D+/g, ''),
    parallelRaw: read('.parallel'),
    name: normalizeDupValue(read('.name')),
    team: normalizeDupValue(read('.team')),
    set: normalizeDupValue(read('.set')),
    year: normalizeDupValue(read('.year')),
    card: normalizeDupValue(read('.cardNumber')),
    parallel: normalizeDupValue(read('.parallel'))
  }
}

function tokenOverlap(a, b) {
  const aTokens = new Set(String(a || '').split(' ').filter(Boolean))
  const bTokens = new Set(String(b || '').split(' ').filter(Boolean))
  if (!aTokens.size || !bTokens.size) return 0

  let overlap = 0
  aTokens.forEach(t => {
    if (bTokens.has(t)) overlap += 1
  })

  return overlap / Math.min(aTokens.size, bTokens.size)
}

function scoreDuplicatePair(a, b) {
  let score = 0
  const nameExact = Boolean(a.name && b.name && a.name === b.name)
  const setExact = Boolean(a.set && b.set && a.set === b.set)
  const yearExact = Boolean(a.year && b.year && a.year === b.year)

  // If both card numbers exist, they must match. If one is missing, rely on stricter anchors below.
  const cardPairPresent = Boolean(a.card && b.card)
  const cardMissingOnOneSide = Boolean((a.card && !b.card) || (!a.card && b.card))
  if (cardPairPresent) {
    if (a.card === b.card) {
      score += 5
    } else {
      // Allow minor OCR formatting drift only when numeric core still agrees.
      if (!a.cardDigits || !b.cardDigits || a.cardDigits !== b.cardDigits) return -999
      score += 4
    }
  }

  let nameAnchor = false
  if (a.name && b.name) {
    if (a.name === b.name) {
      score += 4
      nameAnchor = true
    } else if ((a.name.includes(b.name) || b.name.includes(a.name)) && Math.min(a.name.length, b.name.length) >= 6) {
      score += 2
      nameAnchor = true
    }
  }

  let teamAnchor = false
  if (a.team && b.team && a.team === b.team) {
    score += 2
    teamAnchor = true
  }

  if (a.set && b.set) {
    if (a.set === b.set) score += 2
    else if (tokenOverlap(a.set, b.set) >= 0.6) score += 1
  }

  const setAnchor = (a.set && b.set) ? (a.set === b.set || tokenOverlap(a.set, b.set) >= 0.6) : false

  const yearAnchor = a.year && b.year && a.year === b.year
  if (yearAnchor) score += 1

  if (a.parallel && b.parallel) {
    if (a.parallel === b.parallel) score += 1
    else return -999
  }

  // Without card number anchors, require exact identity on name/team/set/year.
  const exactIdentityAnchor = (nameExact && teamAnchor && setExact && yearExact)
  const fuzzyIdentityAnchor = (nameExact && teamAnchor && setAnchor && yearExact)
  const anchorOk = cardPairPresent
    || (nameExact && teamAnchor && setExact && yearExact)
    || (nameAnchor && teamAnchor && setAnchor && yearExact)
  if (!anchorOk) return -999

  // If one card number is missing, allow exact/fuzzy identity anchors but keep team+year exact.
  if (cardMissingOnOneSide && !(exactIdentityAnchor || fuzzyIdentityAnchor)) return -999

  return score
}

function collapseAllDuplicateRows() {
  let merged = 0
  let changed = true

  while (changed) {
    changed = false
    const rows = [...tableBody.querySelectorAll('tr')]
    for (const row of rows) {
      if (!row.isConnected) continue
      if (collapseDuplicateRowIfNeeded(row)) {
        merged += 1
        changed = true
      }
    }
  }

  return merged
}

function mergeMissingFields(targetRow, sourceRow) {
  const selectors = [
    '.name', '.team', '.position', '.set', '.year', '.cardNumber', '.parallel',
    '.title', '.description', '.filename', '.pictureUrl'
  ]

  selectors.forEach((selector) => {
    const target = targetRow.querySelector(selector)
    const source = sourceRow.querySelector(selector)
    if (!target || !source) return
    if (!String(target.value || '').trim() && String(source.value || '').trim()) {
      target.value = source.value
    }
  })
}

function incrementQuantity(row, amount = 1) {
  const qtyInput = row.querySelector('.quantity')
  if (!qtyInput) return
  const current = Math.max(1, Number(qtyInput.value || 1))
  qtyInput.value = String(current + Math.max(1, amount))
}

function collapseDuplicateRowIfNeeded(row) {
  const source = rowDuplicateData(row)
  const candidates = [...tableBody.querySelectorAll('tr')].filter(r => r !== row)

  let best = null
  let bestScore = -Infinity

  candidates.forEach((candidateRow) => {
    const candidate = rowDuplicateData(candidateRow)
    const score = scoreDuplicatePair(source, candidate)
    if (score > bestScore) {
      bestScore = score
      best = candidateRow
    }
  })

  if (!best || bestScore < 6) return false

  mergeMissingFields(best, row)
  incrementQuantity(best, Number(row.querySelector('.quantity')?.value || 1))
  revokeRowPreviewUrls(row)
  row.remove()
  updatePickFromOptions()
  persistScanDraftSnapshot()
  if (typeof window.requestTableAutoSize === 'function') {
    window.requestTableAutoSize()
  }
  return true
}

async function analyzeImageBuffer(buffer, signal) {
  const sleepWithAbort = (ms) => new Promise((resolve, reject) => {
    if (!ms || ms <= 0) {
      resolve()
      return
    }

    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }
  })

  const waitForOcrSlot = async () => {
    while (true) {
      const now = Date.now()

      const sinceLastCall = now - ocrLastCallStartMs
      if (ocrLastCallStartMs && sinceLastCall < OCR_MIN_INTERVAL_MS) {
        await sleepWithAbort(Math.max(100, OCR_MIN_INTERVAL_MS - sinceLastCall))
        continue
      }

      if (now - ocrWindowStartMs >= OCR_WINDOW_MS) {
        ocrWindowStartMs = now
        ocrCallsInWindow = 0
      }

      const safeBudget = Math.max(1, OCR_MAX_PER_WINDOW - OCR_CLIENT_HEADROOM)
      if (ocrCallsInWindow < safeBudget) {
        ocrCallsInWindow += 1
        ocrLastCallStartMs = now
        return
      }

      const waitMs = Math.max(250, OCR_WINDOW_MS - (now - ocrWindowStartMs) + 50)
      await sleepWithAbort(waitMs)
    }
  }

  const postAnalyze = async () => {
    await waitForOcrSlot()

    const formData = new FormData();
    formData.append("image", new Blob([buffer]));

    const backendUrl = await getBackendUrl();
    const res = await fetch(`${backendUrl}/analyze`, {
      method: "POST",
      body: formData,
      signal
    });

    let data = null
    try {
      data = await res.json()
    } catch {
      data = null
    }

    return { res, data }
  }

  const maxAttempts = 8
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { res, data } = await postAnalyze()
    if (res.ok) return data

    const isRateLimited = res.status === 429
    const retryAfterHeader = Number(res.headers.get('Retry-After') || 0)
    const details = data?.details || data?.error || `HTTP ${res.status}`

    if (!isRateLimited || attempt === maxAttempts) {
      const err = new Error(details)
      err.payload = data
      throw err
    }

    // Back off aggressively when the backend window is saturated.
    ocrWindowStartMs = Date.now()
    ocrCallsInWindow = Math.max(ocrCallsInWindow, Math.max(1, OCR_MAX_PER_WINDOW - OCR_CLIENT_HEADROOM))

    const retryDelayMs = Math.max(3000, (Number.isFinite(retryAfterHeader) ? retryAfterHeader : 2) * 1000)
    await sleepWithAbort(retryDelayMs)
  }

  throw new Error('Analyze request failed after retries')
}

async function detectImageSide(buffer, signal) {
  const quickSide = await detectImageSideInBrowser(buffer)
  if (quickSide) return quickSide

  const formData = new FormData();
  formData.append("image", new Blob([buffer]));

  const backendUrl = await getBackendUrl();
  const res = await fetch(`${backendUrl}/detect-front-back`, {
    method: "POST",
    body: formData,
    signal
  });

  if (!res.ok) return null
  const data = await res.json();
  return String(data?.side || '').toLowerCase() || null
}

async function detectImageSideInBrowser(buffer) {
  try {
    const blob = new Blob([buffer])
    const imageData = await readImageDataForSideDetection(blob)
    if (!imageData) return null

    const pixels = imageData.data
    const totalPixels = imageData.width * imageData.height
    if (!totalPixels) return null

    let sum = 0
    let sumSq = 0

    for (let i = 0; i < pixels.length; i += 4) {
      const gray = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114
      sum += gray
      sumSq += gray * gray
    }

    const mean = sum / totalPixels
    const variance = Math.max(0, (sumSq / totalPixels) - (mean * mean))
    const stdev = Math.sqrt(variance)

    return mean > 110 && stdev > 40 ? 'front' : 'back'
  } catch (err) {
    console.warn('Browser side detection failed, falling back to backend', err)
    return null
  }
}

async function readImageDataForSideDetection(blob) {
  const maxSide = 240

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    try {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
      const width = Math.max(1, Math.round(bitmap.width * scale))
      const height = Math.max(1, Math.round(bitmap.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return null
      ctx.drawImage(bitmap, 0, 0, width, height)
      return ctx.getImageData(0, 0, width, height)
    } finally {
      bitmap.close()
    }
  }

  const image = await loadImageElementFromBlob(blob)
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(image, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height)
}

function loadImageElementFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    img.src = url
  })
}

function normalizeUiYearValue(rawYear) {
  const value = String(rawYear || '').trim()
  if (!value) return null

  if (value.includes('2025') && value.includes('2026')) return '2025-2026'
  if (value.includes('2025')) return '2025'
  if (value.includes('2026')) return '2026'

  return null
}

function normalizePositionForUi(rawPosition) {
  const raw = String(rawPosition || '').trim()
  if (!raw) return null

  const compactMap = {
    quarterback: 'QB',
    qb: 'QB',
    widereceiver: 'WR',
    wr: 'WR',
    runningback: 'RB',
    rb: 'RB',
    tightend: 'TE',
    te: 'TE',
    linebacker: 'LB',
    lb: 'LB',
    cornerback: 'CB',
    cb: 'CB',
    safety: 'S',
    s: 'S',
    strongsafety: 'SS',
    ss: 'SS',
    freesafety: 'FS',
    fs: 'FS',
    defensivelineman: 'DL',
    dl: 'DL',
    defensiveend: 'DE',
    de: 'DE',
    defensivetackle: 'DT',
    dt: 'DT',
    offensiveline: 'OL',
    ol: 'OL',
    offensivetackle: 'OT',
    ot: 'OT',
    offensiveguard: 'OG',
    og: 'OG',
    center: 'C',
    c: 'C',
    kicker: 'K',
    k: 'K',
    punter: 'P',
    p: 'P',
    fullback: 'FB',
    fb: 'FB'
  }

  const tokenized = raw.toLowerCase().split(/[\s/|,;()\-]+/).filter(Boolean)
  for (const token of tokenized) {
    const canonical = compactMap[token]
    if (canonical) return canonical
  }

  const compact = raw.toLowerCase().replace(/[^a-z]/g, '')
  return compactMap[compact] || null
}

function formatAiMeta(data) {
  const providerFromField = String(data?.analysisProvider || '').trim().toLowerCase()
  const providerFromAttempts = Array.isArray(data?.diagnostics?.providerAttempts)
    ? String(data.diagnostics.providerAttempts[0]?.provider || '').trim().toLowerCase()
    : ''

  const provider = providerFromField || providerFromAttempts
  const confidence = String(data?.providerConfidence || '').trim()

  if (!provider && !confidence) {
    return {
      text: '-',
      providerClass: ''
    }
  }

  const providerTextMap = {
    azure: 'AZ',
    cardsight: 'CS',
    'cardsight+azure': 'CS+AZ',
    'azure+cardsight': 'AZ+CS'
  }

  const providerText = providerTextMap[provider] || provider.toUpperCase()
  const text = confidence ? `${providerText} ${confidence}` : providerText

  let providerClass = ''
  if (provider.includes('cardsight') && provider.includes('azure')) providerClass = 'provider-hybrid'
  else if (provider.includes('cardsight')) providerClass = 'provider-cardsight'
  else if (provider.includes('azure')) providerClass = 'provider-azure'

  return {
    text,
    providerClass
  }
}

function applyAiMetaToRow(row, data) {
  const metaEl = row.querySelector('.aiMeta')
  if (!metaEl) return

  const { text, providerClass } = formatAiMeta(data)
  metaEl.textContent = text
  metaEl.className = 'aiMeta'
  if (providerClass) metaEl.classList.add(providerClass)
}

function finalUiYear(frontYear, backYear) {
  const front = normalizeUiYearValue(frontYear)
  const back = normalizeUiYearValue(backYear)

  if ((front === '2025' && back === '2026') || (front === '2026' && back === '2025')) {
    return '2025-2026'
  }

  return front || back || '2025-2026'
}

function applyExtractionToRow(row, data) {
  row.querySelector(".name").value = data.player || "";
  row.querySelector(".team").value = data.team || "";
  row.querySelector(".set").value = data.set || "";
  const normalizedYear = normalizeUiYearValue(data.year)
  row.querySelector(".year").value = normalizedYear || '';
  row.querySelector(".position").value = normalizePositionForUi(data.position) || "";
  row.querySelector(".cardNumber").value = data.cardNumber || "";
  row.querySelector(".parallel").value = data.parallel || "";
  applyAiMetaToRow(row, data)
  if (typeof window.requestTableAutoSize === 'function') {
    window.requestTableAutoSize()
  }
}

function mergeFrontBackExtraction(frontData, backData) {
  const TEAM_ALIASES = {
    cardinals: 'Arizona Cardinals',
    falcons: 'Atlanta Falcons',
    ravens: 'Baltimore Ravens',
    bills: 'Buffalo Bills',
    panthers: 'Carolina Panthers',
    bears: 'Chicago Bears',
    bengals: 'Cincinnati Bengals',
    browns: 'Cleveland Browns',
    cowboys: 'Dallas Cowboys',
    broncos: 'Denver Broncos',
    lions: 'Detroit Lions',
    packers: 'Green Bay Packers',
    texans: 'Houston Texans',
    colts: 'Indianapolis Colts',
    jaguars: 'Jacksonville Jaguars',
    chiefs: 'Kansas City Chiefs',
    raiders: 'Las Vegas Raiders',
    chargers: 'Los Angeles Chargers',
    rams: 'Los Angeles Rams',
    dolphins: 'Miami Dolphins',
    vikings: 'Minnesota Vikings',
    patriots: 'New England Patriots',
    saints: 'New Orleans Saints',
    giants: 'New York Giants',
    jets: 'New York Jets',
    eagles: 'Philadelphia Eagles',
    steelers: 'Pittsburgh Steelers',
    '49ers': 'San Francisco 49ers',
    seahawks: 'Seattle Seahawks',
    buccaneers: 'Tampa Bay Buccaneers',
    titans: 'Tennessee Titans',
    commanders: 'Washington Commanders'
  }

  const hasNarrativeNoise = (value) => {
    const v = String(value || '').toLowerCase()
    return v.includes('record for career') || v.includes('touchdown') || v.includes('catches') || v.includes('not just a tight end')
  }

  const canonicalTeamFrom = (...values) => {
    for (const value of values) {
      const v = String(value || '').toLowerCase()
      if (!v || hasNarrativeNoise(v)) continue
      for (const [alias, team] of Object.entries(TEAM_ALIASES)) {
        if (v.includes(alias)) return team
      }
    }
    return null
  }

  const sanitizeSet = (value) => {
    if (!value) return null
    const text = String(value).trim()
    if (hasNarrativeNoise(text)) return null
    if (/\brecords?\s+for\b/i.test(text)) return null

    // Preserve meaningful full set labels found inside legal/copyright lines.
    const lowered = text.toLowerCase()
    if (lowered.includes('topps signature class')) return 'Topps Signature Class'
    if (lowered.includes('donruss') && lowered.includes('optic')) return 'Donruss Optic'
    if (lowered.includes('panini') && lowered.includes('prizm')) return 'Panini Prizm'

    // Trim noisy legal wrapper text while keeping the core set phrase when possible.
    const legalNoise = /(all rights reserved|the topps company|\u00ae|\u2122|\(r\)|\(tm\))/i
    if (legalNoise.test(text)) {
      const phrase = text.match(/\b(topps\s+signature\s+class|donruss\s+optic|panini\s+prizm|topps|optic|prizm)\b/i)
      if (phrase?.[1]) {
        const p = phrase[1]
        return p.replace(/\b\w/g, c => c.toUpperCase())
      }
    }

    return text
  }

  const sanitizePlayer = (value) => {
    if (!value) return null
    const text = String(value).trim()
    if (!text) return null
    if (hasNarrativeNoise(text)) return null
    if (/\b(hold|round|pick|topps|optic|donruss|panini|nfl|cardinals?|arizona)\b/i.test(text)) return null
    if (/^[,.;:]/.test(text)) return null
    if (/\b(record|career|touchdown|catches|tight end)\b/i.test(text)) return null
    if (!/^[A-Za-z .'-]{3,40}$/.test(text)) return null
    const words = text.split(/\s+/).filter(Boolean)
    if (words.length < 2 || words.length > 4) return null

    const statTokens = new Set(['ATT', 'YDS', 'TD', 'CMP', 'PCT', 'INT', 'REC', 'TGT', 'RUSH', 'AVG'])
    const upperWords = words.map(w => w.replace(/[^A-Za-z]/g, '').toUpperCase()).filter(Boolean)
    if (upperWords.length >= 2 && upperWords.every(w => statTokens.has(w))) return null

    return text
  }

  const sanitizePosition = (value) => {
    return normalizePositionForUi(value)
  }

  const safeYearFrom = (yearValue, ...contextValues) => {
    if (contextValues.some(hasNarrativeNoise)) return null
    return normalizeUiYearValue(yearValue)
  }

  const safeCardNumber = (value, source) => {
    let v = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')

    const normalizeAmbiguousOcrDigits = (token) => {
      // Common on Topps Signature Class style numbers: SNI80S -> SN1805
      const snMatch = token.match(/^([A-Z]{1,2})([A-Z0-9-]+)$/)
      if (!snMatch) return token
      const prefix = snMatch[1]
      let rest = snMatch[2]

      // If suffix already has digits, treat ambiguous letters as likely digits.
      if (/\d/.test(rest)) {
        rest = rest
          .replace(/[I|L]/g, '1')
          .replace(/O/g, '0')
          .replace(/S/g, '5')
      }

      return `${prefix}${rest}`
    }

    v = normalizeAmbiguousOcrDigits(v)

    // Reject long SKU-like product codes often seen in legal/footer lines,
    // e.g., SN1805, which are not the actual printed card number.
    if (/^[A-Z]{2,4}\d{4,}$/.test(v)) return null

    if (!/\d/.test(v)) {
      if (/^[IL|]+$/.test(v)) v = '1'
      else if (/^O+$/.test(v)) v = '0'
      else if (/^S+$/.test(v)) v = '5'
    }
    if (!v) return null
    if (!/^[A-Z0-9-]{1,10}$/i.test(v)) return null
    if (!/\d/.test(v)) return null
    return v
  }

  const extractCardNumberFromPreview = (text) => {
    const content = String(text || '')
    if (!content) return null
    const explicit = content.match(/(?:\bno\.?\s*|\bcard\b\s*(?:#|number|no\.?)?\s*[:#-]?\s*)([A-Z0-9-]{1,10})\b/i)
    if (explicit?.[1] && /\d/.test(explicit[1])) return explicit[1]
    return null
  }

  const extractToppsSignatureCardNumber = (text) => {
    const content = String(text || '')
    if (!content) return null

    const explicit = content.match(/\b(?:no\.?|card\s*#?)\s*[:#-]?\s*(\d{1,2})\b/i)
    if (explicit?.[1]) return explicit[1]

    const isolated = content.match(/(?:^|\s)(\d{1,2})(?:\s|$)/)
    if (isolated?.[1]) return isolated[1]

    return null
  }

  const scoreCardNumber = (value) => {
    if (!value) return -1
    const v = String(value).trim()
    if (/^\d{3,4}$/.test(v)) return 4
    if (/^[A-Z]?\d{3,4}[A-Z]?$/.test(v)) return 3
    if (/^\d{1,2}$/.test(v)) return 1
    if (/^[A-Z0-9-]{1,10}$/i.test(v) && /\d/.test(v)) return 2
    return 0
  }

  const frontYear = safeYearFrom(frontData.year, frontData.set, frontData.team)
  const backYear = safeYearFrom(backData.year, backData.set, backData.team)
  const mergedYear = finalUiYear(frontYear, backYear)

  const mergedTeam = canonicalTeamFrom(frontData.team, frontData.set, backData.team, backData.set)

  const mergedSet = sanitizeSet(frontData.set) || sanitizeSet(backData.set) || null
  const mergedPlayer = sanitizePlayer(backData.player) || sanitizePlayer(frontData.player) || null
  const mergedPosition = sanitizePosition(backData.position) || sanitizePosition(frontData.position) || null

  const backCardNumber = safeCardNumber(backData.cardNumber, 'back')
  const frontCardNumber = safeCardNumber(frontData.cardNumber, 'front')
  const backTopRightCard = safeCardNumber(backData.topRightCardNumber, 'back')
  const frontTopRightCard = safeCardNumber(frontData.topRightCardNumber, 'front')
  const backPreviewCard = safeCardNumber(extractCardNumberFromPreview(backData.ocrPreview), 'back')
  const frontPreviewCard = safeCardNumber(extractCardNumberFromPreview(frontData.ocrPreview), 'front')
  const isToppsSignatureClass = /topps\s+signature\s+class/i.test(String(mergedSet || ''))
  const backToppsSignatureCard = isToppsSignatureClass
    ? safeCardNumber(extractToppsSignatureCardNumber(backData.ocrPreview), 'back')
    : null
  const frontToppsSignatureCard = isToppsSignatureClass
    ? safeCardNumber(extractToppsSignatureCardNumber(frontData.ocrPreview), 'front')
    : null

  const candidates = [
    { value: backToppsSignatureCard, source: 'backToppsSignature' },
    { value: backTopRightCard, source: 'backTopRight' },
    { value: backPreviewCard, source: 'backPreview' },
    { value: backCardNumber, source: 'backParsed' },
    { value: frontToppsSignatureCard, source: 'frontToppsSignature' },
    { value: frontTopRightCard, source: 'frontTopRight' },
    { value: frontPreviewCard, source: 'frontPreview' },
    { value: frontCardNumber, source: 'frontParsed' }
  ].filter(c => Boolean(c.value))

  const sourceWeight = {
    backToppsSignature: 70,
    backTopRight: 60,
    backPreview: 50,
    backParsed: 40,
    frontToppsSignature: 35,
    frontTopRight: 25,
    frontPreview: 20,
    frontParsed: 10
  }

  let mergedCardNumber = null
  if (candidates.length) {
    const scoredByValue = new Map()

    for (const candidate of candidates) {
      const value = candidate.value
      const base = scoreCardNumber(value)
      const weight = sourceWeight[candidate.source] || 0
      const isSingleDigit = /^\d$/.test(value)
      const singleDigitPenalty = isSingleDigit && (candidate.source === 'backParsed' || candidate.source === 'frontParsed') ? 35 : 0
      const current = scoredByValue.get(value) || 0
      scoredByValue.set(value, current + base + weight - singleDigitPenalty)
    }

    for (const [value] of scoredByValue.entries()) {
      const corroborationCount = candidates.filter(c => c.value === value).length
      if (corroborationCount > 1) {
        scoredByValue.set(value, scoredByValue.get(value) + ((corroborationCount - 1) * 30))
      }
    }

    let bestValue = null
    let bestScore = -Infinity
    for (const [value, score] of scoredByValue.entries()) {
      if (score > bestScore) {
        bestScore = score
        bestValue = value
      }
    }

    mergedCardNumber = bestValue
  }

  console.log('[merge-card-number]', {
    backToppsSignatureCard,
    backTopRightCard,
    backPreviewCard,
    backCardNumber,
    frontToppsSignatureCard,
    frontTopRightCard,
    frontPreviewCard,
    frontCardNumber,
    mergedCardNumber
  })

  return {
    player: mergedPlayer,
    team: mergedTeam,
    position: mergedPosition,
    set: mergedSet,
    year: mergedYear,
    // Prioritize card number from BACK to avoid jersey number from front image.
    cardNumber: mergedCardNumber,
    parallel: frontData.parallel || backData.parallel || null,
    ocrPreview: frontData.ocrPreview || backData.ocrPreview || null,
    analysisProvider: [backData.analysisProvider, frontData.analysisProvider]
      .filter(Boolean)
      .filter((value, index, arr) => arr.indexOf(value) === index)
      .join('+') || null,
    providerConfidence: backData.providerConfidence || frontData.providerConfidence || null
  }
}

async function runSingleAIExtraction(row, buffer, signal) {
  try {
    const data = await analyzeImageBuffer(buffer, signal)

    const extractedValues = [
      data.player,
      data.team,
      data.set,
      data.year,
      data.position,
      data.cardNumber,
      data.parallel
    ];
    const hasAnyExtractedField = extractedValues.some(Boolean);

    if (!hasAnyExtractedField) {
      const aiStatus = document.getElementById('aiStatus')
      aiStatus.style.display = 'block'
      if (data.ocrPreview) {
        aiStatus.textContent = `OCR detected text but field mapping was low confidence. Preview: ${data.ocrPreview}`
      } else {
        aiStatus.textContent = 'OCR completed but no mapped card fields were detected for this image.'
      }
      return
    }

    applyExtractionToRow(row, data)
    collapseDuplicateRowIfNeeded(row)

    const aiStatus = document.getElementById('aiStatus')
    aiStatus.style.display = 'none'
  } catch (err) {
    if (err?.name === 'AbortError') return
    const aiStatus = document.getElementById('aiStatus')
    aiStatus.style.display = 'block'
    aiStatus.textContent = 'AI extraction failed: see console or backend logs.'
    console.error("AI extraction failed:", err);
  }
}

async function runPairedAIExtraction(row, frontBuffer, backBuffer, signal) {
  try {
    // Run sequentially to avoid bursty OCR traffic that can trip rate limiting.
    const frontData = await analyzeImageBuffer(frontBuffer, signal)
    const backData = await analyzeImageBuffer(backBuffer, signal)

    const merged = mergeFrontBackExtraction(frontData, backData)
    const extractedValues = [
      merged.player,
      merged.team,
      merged.set,
      merged.year,
      merged.position,
      merged.cardNumber,
      merged.parallel
    ]
    const hasAnyExtractedField = extractedValues.some(Boolean)

    if (!hasAnyExtractedField) {
      const aiStatus = document.getElementById('aiStatus')
      aiStatus.style.display = 'block'
      if (merged.ocrPreview) {
        aiStatus.textContent = `OCR detected text but field mapping was low confidence. Preview: ${merged.ocrPreview}`
      } else {
        aiStatus.textContent = 'OCR completed for front/back images but no mapped card fields were detected.'
      }
      return
    }

    applyExtractionToRow(row, merged)
    collapseDuplicateRowIfNeeded(row)

    const aiStatus = document.getElementById('aiStatus')
    aiStatus.style.display = 'none'
  } catch (err) {
    if (err?.name === 'AbortError') return
    const aiStatus = document.getElementById('aiStatus')
    aiStatus.style.display = 'block'
    aiStatus.textContent = `AI extraction failed: ${err.message || 'see console or backend logs.'}`
    console.error('Paired AI extraction failed:', err)
  }
}

// Generate Titles
document.getElementById("generateTitlesBtn").addEventListener("click", async () => {
  const rows = [...tableBody.querySelectorAll("tr")]
  startProgress('Generating titles...', rows.length)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    updateProgress(i + 1, rows.length, `Generating title ${i + 1} of ${rows.length}...`)
    const payload = collectRowData(row);

    const backendUrl = await getBackendUrl();
    const res = await fetch(`${backendUrl}/generate-title`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Title generation failed: ${res.status}`)
    }

    const data = await res.json();
    row.querySelector(".title").value = data.title || "";
  }

  finishProgress('Title generation complete.')
});

// Generate Descriptions
document.getElementById("generateDescriptionsBtn").addEventListener("click", async () => {
  const rows = [...tableBody.querySelectorAll("tr")]
  startProgress('Generating descriptions...', rows.length)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    updateProgress(i + 1, rows.length, `Generating description ${i + 1} of ${rows.length}...`)
    const payload = collectRowData(row);

    const backendUrl = await getBackendUrl();
    const res = await fetch(`${backendUrl}/generate-description`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Description generation failed: ${res.status}`)
    }

    const data = await res.json();
    row.querySelector(".description").value = data.description || "";
  }

  finishProgress('Description generation complete.')
});

document.getElementById("refreshPickOptionsBtn").addEventListener("click", () => {
  updatePickFromOptions();
});

// Generate Filenames
document.getElementById("generateFilenamesBtn").addEventListener("click", async () => {
  const rows = [...tableBody.querySelectorAll("tr")]
  startProgress('Generating filenames...', rows.length)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    updateProgress(i + 1, rows.length, `Generating filename ${i + 1} of ${rows.length}...`)
    const payload = collectRowData(row);
    const backendUrl = await getBackendUrl();

    const res = await fetch(`${backendUrl}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    row.querySelector(".filename").value = data.filename || "";
  }

  finishProgress('Filename generation complete.')
});

// Add empty row
document.getElementById("addRowBtn").addEventListener("click", () => {
  addRow(null, null, null, null);
});

discardScanDraftBtn?.addEventListener('click', discardUnsavedScanDraft)

// Export CSV
document.getElementById("exportCsvBtn").addEventListener("click", () => {
  let csv = "PairType,SKU,Name,Team,Position,Set,Year,CardNumber,Quantity,Parallel,Rookie,Autograph,Title,Description,PickFrom,VariationTheme,MultiBuyOffer,Filename,PictureURL\n";

  for (const row of tableBody.querySelectorAll("tr")) {
    const d = collectRowData(row);
    const variationTheme = d.Team && d.Set ? `${d.Team} - ${d.Set}` : "";
    const multiBuyOffer = "Buy 5, get 1 free";
    csv += `${d.Side},${d.SKU},${d.Name},${d.Team},${d.Position},${d.Set},${d.Year},${d.CardNumber},${d.Quantity},${d.Parallel},${d.Rookie},${d.Autograph},${d.Title},${d.Description},${d.PickFrom},${variationTheme},${multiBuyOffer},${d.Filename},${d.PictureURL}\n`;
  }

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "cards.csv";
  a.click();
});

// Download ZIP of renamed images
document.getElementById("downloadZipBtn").addEventListener("click", async () => {
  const zip = new JSZip();
  const rows = [...tableBody.querySelectorAll("tr")]
  startProgress('Preparing ZIP download...', rows.length)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    updateProgress(i + 1, rows.length, `Adding row ${i + 1} of ${rows.length} to ZIP...`)
    const filename = row.querySelector(".filename").value || "unnamed.jpg";

    if (row.frontBuffer) {
      const frontName = row.backBuffer ? filename.replace(/(\.[a-z0-9]+)$/i, '-front$1') : filename
      zip.file(frontName, row.frontBuffer);
    }
    if (row.backBuffer) {
      const backName = filename.replace(/(\.[a-z0-9]+)$/i, '-back$1')
      zip.file(backName, row.backBuffer);
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "renamed_images.zip";
  a.click();

  finishProgress('ZIP ready and downloaded.')
});

document.getElementById("generatePictureUrlsBtn").addEventListener("click", () => {
  const baseUrlInput = document.getElementById("pictureBaseUrl")
  const baseUrl = (baseUrlInput?.value || '').trim().replace(/\/+$/, '')
  const aiStatus = document.getElementById('aiStatus')

  if (!baseUrl) {
    aiStatus.style.display = 'block'
    aiStatus.textContent = 'Enter a Picture base URL first, then click Generate Picture URLs.'
    return
  }

  for (const row of tableBody.querySelectorAll("tr")) {
    const filenameField = row.querySelector(".filename")
    const pictureUrlField = row.querySelector(".pictureUrl")
    const fallbackName = row.frontFile?.name || row.backFile?.name || ''
    const filename = (filenameField.value || fallbackName).trim()
    if (!filename) continue

    const encodedName = encodeURIComponent(filename)
    pictureUrlField.value = `${baseUrl}/${encodedName}`
  }

  aiStatus.style.display = 'none'
});

function collectRowData(row) {
  return {
    Side: row.querySelector(".side").value,
    SKU: row.querySelector(".sku")?.value || '',
    Name: row.querySelector(".name").value,
    Team: row.querySelector(".team").value,
    Position: row.querySelector(".position").value,
    Set: row.querySelector(".set").value,
    Year: row.querySelector(".year").value,
    CardNumber: row.querySelector(".cardNumber").value,
    Quantity: row.querySelector(".quantity")?.value || '1',
    Parallel: row.querySelector(".parallel").value,
    Rookie: row.querySelector(".rookie").value,
    Autograph: row.querySelector(".autograph").value,
    Title: row.querySelector(".title").value,
    Description: row.querySelector(".description").value,
    PickFrom: row.querySelector(".pickFrom").value,
    Filename: row.querySelector(".filename").value,
    PictureURL: row.querySelector(".pictureUrl").value
  };
}

window.addEventListener('beforeunload', () => {
  if ([...tableBody.querySelectorAll('tr')].length) {
    persistScanDraftSnapshot()
    void persistScanDraftSnapshotNow()
  }
})

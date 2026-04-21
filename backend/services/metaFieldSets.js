// Centralized `fields` parameter values for Meta Graph API calls.
//
// Rule: never request `fields=*`. Meta charges quota per field fetched.
// When a new column is needed in the DB, add it here and the sync picks it up.

export const FIELD_SETS = {
  adAccount: [
    'id',
    'name',
    'account_status',
    'currency',
    'timezone_name',
    'business',
    'amount_spent',
    'balance',
    'disable_reason',
  ],

  campaign: [
    'id',
    'name',
    'objective',
    'status',
    'effective_status',
    'daily_budget',
    'lifetime_budget',
    'buying_type',
    'special_ad_categories',
    'start_time',
    'stop_time',
    'updated_time',
  ],

  adset: [
    'id',
    'name',
    'campaign_id',
    'status',
    'effective_status',
    'daily_budget',
    'lifetime_budget',
    'optimization_goal',
    'billing_event',
    'bid_strategy',
    'targeting',
    'start_time',
    'end_time',
    'updated_time',
  ],

  ad: [
    'id',
    'name',
    'adset_id',
    'campaign_id',
    'status',
    'effective_status',
    'creative{id,name,thumbnail_url,body,title}',
    'preview_shareable_link',
    'tracking_specs',
    'updated_time',
  ],

  // Metrics fetched once per (entity, date). time_increment=1 forces daily rows.
  // Entity id fields MUST be requested explicitly — Meta omits them by default
  // even when you set level=campaign/adset/ad, which leaves rows unjoinable.
  insights: [
    'campaign_id',
    'campaign_name',
    'adset_id',
    'adset_name',
    'ad_id',
    'ad_name',
    'account_id',
    'account_name',
    'impressions',
    'reach',
    'frequency',
    'clicks',
    'unique_clicks',
    'inline_link_clicks',
    'spend',
    'cpm',
    'cpc',
    'ctr',
    'actions',
    'action_values',
    'cost_per_action_type',
    'conversions',
    'conversion_values',
    'video_thruplay_watched_actions',
    'account_currency',
    'date_start',
    'date_stop',
  ],

  page: [
    'id',
    'name',
    'access_token',
    'tasks',
    'category',
    'instagram_business_account{id,username}',
  ],

  leadForm: [
    'id',
    'name',
    'status',
    'locale',
    'page',
    'questions',
    'leads_count',
    'created_time',
  ],

  // Individual leadgen row (webhook handler + poller both use this).
  lead: [
    'id',
    'created_time',
    'ad_id',
    'adset_id',
    'campaign_id',
    'form_id',
    'field_data',
    'platform',
    'is_organic',
    'partner_name',
  ],
};

export const joinFields = (key) => {
  const set = FIELD_SETS[key];
  if (!set) throw new Error(`Unknown field set: ${key}`);
  return set.join(',');
};

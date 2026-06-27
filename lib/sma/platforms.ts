export type Platform = 'instagram' | 'facebook' | 'threads'

export const PLATFORMS: Platform[] = ['instagram', 'facebook', 'threads']

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook Page',
  threads: 'Threads',
}

export const PLATFORM_SCOPES: Record<Platform, string[]> = {
  // Instagram via Facebook Login (Instagram Graph API). The IG Business/Creator
  // account must be linked to the connected Facebook Page. pages_show_list +
  // pages_read_engagement let the flow resolve the Page→IG link. Comment/insights
  // scopes deferred until those features are built (per CLAUDE.md).
  instagram: [
    'instagram_basic',
    'instagram_content_publish',
    'pages_show_list',
    'pages_read_engagement',
  ],
  // pages_manage_engagement + pages_read_user_content removed: they power the
  // not-yet-built comment/inbox features and Meta rejected them as invalid scopes
  // in the current app config. Re-add when those features + App Review land.
  facebook: [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
  ],
  threads: [
    'threads_basic',
    'threads_content_publish',
    'threads_manage_replies',
    'threads_read_replies',
    'threads_manage_insights',
  ],
}

export const PLATFORM_GRAPH_BASE: Record<Platform, string> = {
  instagram: 'https://graph.facebook.com/v23.0',
  facebook: 'https://graph.facebook.com/v23.0',
  threads: 'https://graph.threads.net/v1.0',
}

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as string[]).includes(value)
}

export type Platform = 'instagram' | 'facebook' | 'threads'

export const PLATFORMS: Platform[] = ['instagram', 'facebook', 'threads']

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook Page',
  threads: 'Threads',
}

export const PLATFORM_SCOPES: Record<Platform, string[]> = {
  instagram: [
    'instagram_business_basic',
    'instagram_business_content_publish',
    'instagram_business_manage_comments',
    'instagram_business_manage_insights',
  ],
  facebook: [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'pages_manage_engagement',
    'pages_read_user_content',
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

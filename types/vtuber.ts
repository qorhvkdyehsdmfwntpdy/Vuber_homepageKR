export interface VTuber {
  id: string;
  name: string;
  chzzk_channel_id?: string;
  soop_channel_id?: string;
  youtube_channel_id?: string;
  youtube_url?: string;
  cafe_url?: string;
  profile_image_url?: string;
  created_at?: string;
  live_status?: boolean;
  latest_video_title?: string;
}

export interface LiveStatus {
  vtuber_id: string;
  platform: 'chzzk' | 'soop' | 'youtube';
  is_live: boolean;
  title?: string;
  viewer_count?: number;
  thumbnail_url?: string;
  updated_at: string;
}
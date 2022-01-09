export interface InviteResponse {
  code: string;
  type: number;
  expires_at?: any;
  guild: Guild;
  channel: Channel;
  approximate_member_count: number;
  approximate_presence_count: number;
}

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface Guild {
  id: string;
  name: string;
  splash: string;
  banner: string;
  description?: any;
  icon: string;
  features: string[];
  verification_level: number;
  vanity_url_code: string;
  nsfw: boolean;
  nsfw_level: number;
}

import type { FC, SVGProps } from 'react'
import DefaultIcon from '@/assets/images/web/default.svg?react'
import AppleIcon from '@/assets/images/web/apple.svg?react'
import AmazonIcon from '@/assets/images/web/amazon.svg?react'
import BehanceIcon from '@/assets/images/web/behance.svg?react'
import DribbbleIcon from '@/assets/images/web/dribbble.svg?react'
import DropboxIcon from '@/assets/images/web/dropbox.svg?react'
import FacebookIcon from '@/assets/images/web/facebook.svg?react'
import InstagramIcon from '@/assets/images/web/instagram.svg?react'
import YoutubeIcon from '@/assets/images/web/youtube.svg?react'
import GithubIcon from '@/assets/images/web/github.svg?react'
import GoogleIcon from '@/assets/images/web/google.svg?react'
import LinkedinIcon from '@/assets/images/web/linkedin.svg?react'
import MicrosoftIcon from '@/assets/images/web/microsoft.svg?react'
import NetflixIcon from '@/assets/images/web/netflix.svg?react'
import PayoneerIcon from '@/assets/images/web/payoneer.svg?react'
import PaypalIcon from '@/assets/images/web/paypal.svg?react'
import PinterestIcon from '@/assets/images/web/pinterest.svg?react'
import RedditIcon from '@/assets/images/web/reddit.svg?react'
import SkypeIcon from '@/assets/images/web/skype.svg?react'
import SlackIcon from '@/assets/images/web/slack.svg?react'
import SnapchatIcon from '@/assets/images/web/snapchat.svg?react'
import SpotifyIcon from '@/assets/images/web/spotify.svg?react'
import TwitterIcon from '@/assets/images/web/twitter.svg?react'
import VimeoIcon from '@/assets/images/web/vimeo.svg?react'
import WordpressIcon from '@/assets/images/web/wordpress.svg?react'

interface IconEntry {
  color: string
  icon: FC<SVGProps<SVGSVGElement>>
}

const icons: Record<string, IconEntry> = {
  default: { color: '#4792ff', icon: DefaultIcon },
  amazon: { color: '#FF9900', icon: AmazonIcon },
  apple: { color: '#A3AAAE', icon: AppleIcon },
  behance: { color: '#053eff', icon: BehanceIcon },
  dribbble: { color: '#ea4c89', icon: DribbbleIcon },
  dropbox: { color: '#0060ff', icon: DropboxIcon },
  facebook: { color: '#3b5998', icon: FacebookIcon },
  github: { color: '#2b3137', icon: GithubIcon },
  google: { color: '#DB4437', icon: GoogleIcon },
  instagram: { color: '#F56040', icon: InstagramIcon },
  youtube: { color: '#FF0000', icon: YoutubeIcon },
  linkedin: { color: '#0077B5', icon: LinkedinIcon },
  microsoft: { color: '#F25022', icon: MicrosoftIcon },
  netflix: { color: '#E50914', icon: NetflixIcon },
  payoneer: { color: '#FF4800', icon: PayoneerIcon },
  paypal: { color: '#00457C', icon: PaypalIcon },
  pinterest: { color: '#E50914', icon: PinterestIcon },
  reddit: { color: '#ff4500', icon: RedditIcon },
  skype: { color: '#00aff0', icon: SkypeIcon },
  slack: { color: '#4A154B', icon: SlackIcon },
  snapchat: { color: '#ffd200', icon: SnapchatIcon },
  spotify: { color: '#1DB954', icon: SpotifyIcon },
  twitter: { color: '#1DA1F2', icon: TwitterIcon },
  vimeo: { color: '#19B7EA', icon: VimeoIcon },
  wordpress: { color: '#282828', icon: WordpressIcon }
}

// Derives an icon key from a website URL or bare host (second-level domain),
// e.g. "https://mail.google.com" or "mail.google.com" -> "google".
export const iconKeyForWebsite = (website: string): string => {
  const host = website.trim().replace(/^https?:\/\//, '').split('/')[0]
  const parts = host.replace(/^www\./, '').split('.')
  return parts.length >= 2 ? parts[parts.length - 2] : 'default'
}

export default icons

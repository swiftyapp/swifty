import Swifty from './application'
import unhandled from 'electron-unhandled'
import { openNewGitHubIssue, debugInfo } from 'electron-util'

unhandled({
  reportButton: error => {
    openNewGitHubIssue({
      user: 'swiftyapp',
      repo: 'swifty',
      body: `\`\`\`\n${error.stack}\n\`\`\`\n\n---\n\n${debugInfo()}`
    })
  }
})

new Swifty(CONFIG)

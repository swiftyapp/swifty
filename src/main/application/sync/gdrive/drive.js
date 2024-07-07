const { google } = require('googleapis')

export default class Drive {
  constructor({ auth }) {
    this.drive = google.drive({ version: 'v3', auth: auth })
    this.fields = 'files(id, name)'
    this.fileMimeType = 'application/vnd.swftx'
    this.folderMimeType = 'application/vnd.google-apps.folder'
  }

  async readFile(id) {
    const { data } = await this.drive.files.get({ fileId: id, alt: 'media' })
    return data.text()
  }

  async updateFile(id, content) {
    const { data } = await this.drive.files.update({
      fileId: id,
      media: {
        mimeType: this.fileMimeType,
        body: content
      }
    })
    return data.id
  }

  async fileExists(name, parentId) {
    return await this.exists(
      `name = '${name}' and trashed = false and '${parentId}' in parents`
    )
  }

  async folderExists(name) {
    return await this.exists(`name = '${name}' and trashed = false`)
  }

  async createFile(name, parentId, content) {
    return await this.create({
      requestBody: {
        name: name,
        mimeType: this.fileMimeType,
        parents: [parentId]
      },
      media: {
        mimeType: this.fileMimeType,
        body: content
      }
    })
  }

  async createFolder(name) {
    return await this.create({
      requestBody: {
        name: name,
        mimeType: this.folderMimeType
      }
    })
  }

  async create(body) {
    const { data } = await this.drive.files.create(body)
    return (data && data.id) || null
  }

  async exists(query) {
    const { data } = await this.drive.files.list({
      q: query,
      fields: this.fields
    })
    return (data.files.length > 0 && data.files[0].id) || null
  }
}

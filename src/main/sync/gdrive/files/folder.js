export const folderExists = (name, drive) => {
  return new Promise((resolve, reject) => {
    drive.files
      .list({
        q: `name = '${name}' and trashed = false`,
        fields: 'files(id, name)'
      })
      .then(response => {
        if (response.data && response.data.files.length !== 0) {
          return resolve(response.data.files[0].id)
        } else {
          return resolve(null)
        }
      })
      .catch(error => reject(error))
  })
}

export const createFolder = (name, drive) => {
  return new Promise((resolve, reject) => {
    drive.files
      .create({
        requestBody: {
          name: name,
          mimeType: 'application/vnd.google-apps.folder'
        }
      })
      .then(response => {
        if (response.status === 200) {
          return resolve(response.data.id)
        } else {
          return resolve(null)
        }
      })
      .catch(error => reject(error))
  })
}

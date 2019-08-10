export const createFile = (name, parentId, content, drive) => {
  return new Promise((resolve, reject) => {
    return drive.files
      .create({
        requestBody: {
          name: name,
          mimeType: 'text/plain',
          parents: [parentId]
        },
        media: { body: content }
      })
      .then(response => {
        if (response.status === 200) {
          return resolve(response.data.id)
        }
        return resolve(null)
      })
      .catch(error => reject(error))
  })
}

export const fileExists = (name, parentId, drive) => {
  return new Promise((resolve, reject) => {
    return drive.files
      .list({
        q: `name = '${name}' and '${parentId}' in parents`,
        fields: 'files(id, name)'
      })
      .then(response => {
        if (response.data && response.data.files.length !== 0) {
          return resolve(response.data.files[0].id)
        }
        return resolve(null)
      })
      .catch(error => reject(error))
  })
}

export const updateFile = (fileId, content, drive) => {
  return drive.files.update({
    fileId: fileId,
    media: { body: content }
  })
}

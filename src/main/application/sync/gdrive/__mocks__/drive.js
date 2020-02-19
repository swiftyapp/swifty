let folderExists = true
let fileExists = true
let fileReadable = true
let folderCreatable = true
let fileCreatable = true

const __setFolderExists = value => {
  folderExists = value
}

const __setFileExists = value => {
  fileExists = value
}

const __setFileReadable = value => {
  fileReadable = value
}

const __setFolderCreatable = value => {
  folderCreatable = value
}

const __setFileCreatable = value => {
  fileCreatable = value
}

const createFileMock = jest.fn(() => {
  return Promise.resolve(fileCreatable ? 'FILE_ID' : null)
})

const createFolderMock = jest.fn(() => {
  return Promise.resolve(folderCreatable ? 'FOLDER_ID' : null)
})

const folderExistsMock = jest.fn(async () => {
  return Promise.resolve(folderExists ? 'FOLDER_ID' : null)
})

const fileExistsMock = jest.fn(() => {
  return Promise.resolve(fileExists ? 'FILE_ID' : null)
})

const readFileMock = jest.fn(() => {
  if (fileReadable) {
    return Promise.resolve('DATA')
  } else {
    throw Error('Could not read file')
  }
})
const updateFileMock = jest.fn(() => {
  if (fileReadable) {
    return Promise.resolve('FILE_ID')
  } else {
    throw Error('Could not update file')
  }
})

module.exports = jest.fn(() => {
  return {
    folderExists: folderExistsMock,
    fileExists: fileExistsMock,
    readFile: readFileMock,
    createFolder: createFolderMock,
    createFile: createFileMock,
    updateFile: updateFileMock,
    __setFolderExists: __setFolderExists,
    __setFileExists: __setFileExists,
    __setFileReadable: __setFileReadable,
    __setFolderCreatable: __setFolderCreatable,
    __setFileCreatable: __setFileCreatable
  }
})

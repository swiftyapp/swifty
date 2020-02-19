let folderExists = true
let fileExists = true
let fileReadable = true

const __setFolderExists = value => {
  folderExists = value
}

const __setFileExists = value => {
  fileExists = value
}

const __setFileReadable = value => {
  fileReadable = value
}

const createFileMock = jest.fn()

const folderExistsMock = jest.fn(() => {
  if (folderExists) {
    return Promise.resolve('FOLDER_ID')
  } else {
    throw Error('Folder not found')
  }
})

const fileExistsMock = jest.fn(() => {
  if (fileExists) {
    return Promise.resolve('FILE_ID')
  } else {
    throw Error('File not found')
  }
})

const readFileMock = jest.fn(() => {
  if (fileReadable) {
    return Promise.resolve('DATA')
  } else {
    throw Error('Could not read file')
  }
})
const updateFileMock = jest.fn().mockResolvedValue('FILE_ID')

module.exports = jest.fn(() => {
  return {
    folderExists: folderExistsMock,
    fileExists: fileExistsMock,
    readFile: readFileMock,
    createFile: createFileMock,
    updateFile: updateFileMock,
    __setFolderExists: __setFolderExists,
    __setFileExists: __setFileExists,
    __setFileReadable: __setFileReadable
  }
})

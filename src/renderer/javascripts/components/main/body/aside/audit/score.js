import React from 'react'

const Score = ({ audit }) => {
  const getScore = () => {
    const records = Object.values(audit)
    const result = records.reduce((accumulator, record) => {
      return accumulator + calculateScore(record)
    }, 0)
    return Math.round(((records.length - result) / records.length) * 100) / 10
  }

  const calculateScore = record => {
    let score = 0
    if (record.isWeak) score = score + 0.5
    if (record.isShort) score = score + 0.5
    if (record.isRepeating) score = score + 0.25
    if (record.isOld) score = score + 0.25
    return score
  }

  return (
    <div className="score">
      <div className="points">{getScore()}</div>
      <div className="muted">Overal Score</div>
    </div>
  )
}

export default Score

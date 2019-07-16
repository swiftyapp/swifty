import React from 'react'
import Pencil from 'pencil.svg'
import Delete from 'delete.svg'
import Item from './item'
import { DateTime } from 'luxon'
import { connect } from 'react-redux'
import { deleteEntry } from 'actions/entries'

const Show = ({ entry, onClickDelete, onClickEdit }) => {
  const onEdit = () => {
    onClickEdit()
  }

  const onDelete = () => {
    if (confirm('Are you sure you want to delete this item?')) {
      onClickDelete(entry.id)
    }
  }

  const formatDate = str => {
    return DateTime.fromISO(str).toLocaleString(DateTime.DATETIME_MED)
  }

  return (
    <div className="aside shaded">
      <div className="copied-notification hidden">Copied to Clipboard</div>
      <div className="entry-title">
        <h1>{entry.title}</h1>
        <Pencil width="16" height="16" onClick={onEdit} className="action" />
        <Delete width="16" height="16" onClick={onDelete} className="action" />
      </div>
      <div className="entry-details">
        <Item name="Website" entry={entry} link />
        <Item name="Username" entry={entry} />
        <Item name="Password" entry={entry} secure />
        <Item name="Email" entry={entry} />
      </div>
      <div className="entry-extra">
        <div className="item">
          <div className="label">Last Modified</div>
          <div className="value">{formatDate(entry.updated_at)}</div>
        </div>
        <div className="item">
          <div className="label">Created</div>
          <div className="value">{formatDate(entry.created_at)}</div>
        </div>
      </div>
    </div>
  )
}

const mapDispatchToProps = dispatch => {
  return {
    onClickDelete: id => dispatch(deleteEntry(id)),
    onClickEdit: () => dispatch({ type: 'EDIT_ENTRY' })
  }
}

export default connect(null, mapDispatchToProps)(Show)

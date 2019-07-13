import React from 'react'
import Pencil from 'pencil.svg'
import Delete from 'delete.svg'

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

  return (
    <div className="aside shaded">
      <div className="entry-title">
        <h1>{entry.title}</h1>
        <span onClick={onEdit} className="action">
          <Pencil width="16" height="16" />
        </span>
        <span onClick={onDelete} className="action">
          <Delete width="16" height="16" />
        </span>
      </div>
      <div className="entry-details">
        <div className="item">
          <div className="label">Website</div>
          <div className="value">
            <a href="{entry.website}">{entry.website}</a>
          </div>
        </div>
        <div className="item">
          <div className="label">Username</div>
          <div className="value">{entry.username}</div>
        </div>
        <div className="item">
          <div className="label">Password</div>
          <div className="value">{entry.password}</div>
        </div>
        <div className="item">
          <div className="label">Email</div>
          <div className="value">{entry.email}</div>
        </div>
      </div>
      <div className="entry-extra">
        <div className="item">
          <div className="label">Last Modified</div>
          <div className="value">{entry.updated_at}</div>
        </div>
        <div className="item">
          <div className="label">Created</div>
          <div className="value">{entry.created_at}</div>
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

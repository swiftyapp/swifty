import React from 'react'

export default () => {
  return (
    <div className="aside">
      <div className="field">
        <label htmlFor="">Title</label>
        <input type="text" />
      </div>
      <div className="field">
        <label htmlFor="">Website</label>
        <input type="text" />
      </div>
      <div className="field">
        <label htmlFor="">Username</label>
        <input type="text" />
      </div>
      <div className="field">
        <label htmlFor="">Password</label>
        <input type="text" />
      </div>
      <div className="field">
        <label htmlFor="">Email</label>
        <input type="text" />
      </div>
      <div className="field">
        <label htmlFor="">Note</label>
        <textarea name="" id="" cols="10" rows="5"></textarea>
      </div>
      <div className="action">
        <span className="button">Save</span>
      </div>
    </div>
  )
}

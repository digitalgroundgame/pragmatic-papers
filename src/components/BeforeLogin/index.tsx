import React from "react"

import { ResumeSession } from "./ResumeSession"

const BeforeLogin: React.FC = () => {
  return (
    <div>
      <ResumeSession />
      <p>
        <b>Welcome to your dashboard!</b>
        {" This is where site admins will log in to manage your website."}
      </p>
    </div>
  )
}

export default BeforeLogin

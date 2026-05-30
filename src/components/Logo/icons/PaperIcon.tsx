import React from "react"

export const PaperIcon: React.FC<React.ComponentProps<"svg">> = ({
  fill = "currentColor",
  className,
  style,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill={fill}
      className={className}
      style={style}
    >
      <path d="M3.16,1.7H0s0,16.61,0,16.61h3.2v-6.48c2.42,0,4.34-1.56,4.34-4.88v-.36c0-3.32-1.94-4.88-4.38-4.88ZM4.28,8.26c0,1.06-.36,1.46-.88,1.46h-.2V3.78h.2c.52,0,.88.4.88,1.46v3.02ZM9.03,1.7h10.97v16.61h-10.97V1.7Z" />
    </svg>
  )
}

export const PaperIconAdmin: React.FC<React.ComponentProps<"svg">> = ({
  fill = "currentColor",
  className,
}) => {
  return <PaperIcon fill={fill} className={className} style={{ width: "100%", height: "100%" }} />
}

declare module '*.module.css' {
  // Allow dot access on class names without TS4111 noise
  const classes: any
  export default classes
}

declare module '*.css' {
  // Allow dot access on class names without TS4111 noise
  const classes: any
  export default classes
}

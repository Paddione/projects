module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["l2p", "arena", "auth", "shop", "videovault", "sos", "assetgenerator", "k8s", "docs", "ci", "deps", "root"]
    ],
    "scope-empty": [1, "never"],
    "body-max-line-length": [0]
  }
};

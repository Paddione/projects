module.exports = {
  extends: ["@commitlint/config-conventional"],
  ignores: [(commit) => commit.startsWith('Merge')],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["l2p", "arena", "auth", "shop", "videovault", "sos", "assetgenerator", "k8s", "docs", "ci", "deps", "root", "packages", "mediaviewer-widget"]
    ],
    "scope-empty": [1, "never"],
    "body-max-line-length": [0]
  }
};

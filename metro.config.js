const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const path = require("path");

const config = getSentryExpoConfig(__dirname);
const escapedRoot = __dirname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

config.resolver.blockList = [
  ...(config.resolver.blockList ?? []),
  /(?:^|[\\/])\.agents(?:[\\/].*)?$/,
  /(?:^|[\\/])\.claude(?:[\\/].*)?$/,
  /(?:^|[\\/])\.codex(?:[\\/].*)?$/,
  /(?:^|[\\/])\.superpowers(?:[\\/].*)?$/,
  /(?:^|[\\/])\.impeccable(?:[\\/].*)?$/,
  /(?:^|[\\/])graphify-out(?:[\\/].*)?$/,
  /(?:^|[\\/])docs(?:[\\/].*)?$/,
  /(?:^|[\\/])docs spcs(?:[\\/].*)?$/,
  /(?:^|[\\/])supabase(?:[\\/].*)?$/,
  /(?:^|[\\/])test-results(?:[\\/].*)?$/,
  new RegExp(`^${escapedRoot}${path.sep === "\\" ? "\\\\" : "/"}dist[\\/].*`),
];

module.exports = config;

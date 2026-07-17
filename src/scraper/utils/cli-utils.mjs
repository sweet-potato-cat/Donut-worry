async function printUsage() {
  console.log('e-Campus scraper sandbox')
  console.log('')
  console.log('Commands:')
  console.log('  npm.cmd run scrape:live      Scan weekly-learning materials')
  console.log('  npm.cmd run scrape:download  Scan and download materials')
  console.log('')
  console.log('Options:')
  console.log('  --debug  Save page and frame HTML snapshots under scraper-output/debug')
  console.log('  --course=<name>  Only scan/download courses whose names include <name>')
  console.log('  --deep  Use slower fallback clicks for hard-to-open external tool materials')
  console.log('  --assignments-only  Collect assignments without scanning weekly-learning pages')
  console.log('  --notices-only  Collect notices without scanning weekly-learning pages')
}

function hasCliFlag(name) {
  return process.argv.includes(name)
}

function getCliOption(name) {
  const prefix = `${name}=`
  const option = process.argv.find((argument) => argument.startsWith(prefix))

  return option ? option.slice(prefix.length) : ''
}

export { getCliOption, hasCliFlag, printUsage }

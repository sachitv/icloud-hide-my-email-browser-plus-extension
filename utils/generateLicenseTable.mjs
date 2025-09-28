#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { init as licenseCheckerInit } from 'license-checker-rseidelsohn';

// license-checker exposes a callback interface; wrap it so we can use async/await.
const initAsync = promisify(licenseCheckerInit);

function licenseValueToString(value) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value == null) {
    return 'UNKNOWN';
  }

  return String(value);
}

function normalizeRepositoryUrl(repo) {
  if (!repo || typeof repo !== 'string') {
    return null;
  }

  let cleaned = repo.trim();
  if (cleaned.startsWith('git+')) {
    cleaned = cleaned.slice(4);
  }
  if (cleaned.endsWith('.git')) {
    cleaned = cleaned.slice(0, -4);
  }

  return cleaned;
}

async function main() {
  const start = path.resolve(process.cwd());

  // Collect the dependency graph (direct + transitive) with their license metadata.
  const results = await initAsync({
    start,
    json: true,
  });

  const aggregated = new Map();

  Object.entries(results).forEach(([dependency, info]) => {
    const repoUrl = normalizeRepositoryUrl(info.repository);
    const key = repoUrl || dependency;
    const record = aggregated.get(key) || {
      name: repoUrl ? repoUrl : dependency,
      license: licenseValueToString(info.licenses),
      repository: repoUrl,
      packages: new Set(),
    };

    record.packages.add(dependency);

    if (!record.repository && repoUrl) {
      record.repository = repoUrl;
    }

    aggregated.set(key, record);
  });

  const rows = Array.from(aggregated.values())
    .map((record) => ({
      displayName: record.repository ? record.repository : Array.from(record.packages).sort()[0],
      license: record.license,
      repository: record.repository,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Markdown header for the generated table.
  const lines = ['| Package | License |', '| --- | --- |'];

  rows.forEach((row) => {
    const label = row.repository ? row.repository : row.displayName;
    const link = row.repository ? `[${label}](${row.repository})` : label;
    const license = row.license || 'UNKNOWN';
    lines.push(`| ${link} | ${license} |`);
  });

  console.log(lines.join('\n'));
}

main().catch((error) => {
  console.error('Failed to generate license markdown table:', error);
  process.exitCode = 1;
});

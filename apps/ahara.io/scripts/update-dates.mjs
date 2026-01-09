#!/usr/bin/env node

import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectsPath = join(__dirname, '../src/projects.ts');
const websitesRoot = resolve(__dirname, '../../..');
const parentDir = resolve(websitesRoot, '..');

// Map project IDs to their git repo paths (relative to parent directory)
const repoMap = {
  'glass-frontier': { path: join(parentDir, 'the-glass-frontier'), type: 'external' },
  'the-canonry': { path: join(parentDir, 'penguin-tales'), type: 'external' }, // Same repo as penguin-tales
  'penguin-tales': { path: join(parentDir, 'penguin-tales'), type: 'external' },
  'tsonu-music': { path: join(parentDir, 'tsonu-music'), type: 'external' },
  'hotsauce': { path: join(websitesRoot, 'apps/hotsauce'), type: 'internal' },
  'ru-ai': { path: join(websitesRoot, 'apps/ru-ai.net'), type: 'internal' },
  'slipstream': { path: join(parentDir, 'slipstream'), type: 'external' },
};

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function getGitLastCommitDate(repoPath, subPath = null) {
  try {
    const pathArg = subPath ? `-- "${subPath}"` : '';
    const cmd = `git -C "${repoPath}" log -1 --format=%cs ${pathArg}`;
    const date = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    return date || null;
  } catch {
    return null;
  }
}

function parseProjects(content) {
  const projects = [];

  // Match each project object by finding id and lastUpdated pairs
  const projectRegex = /\{\s*id:\s*['"]([^'"]+)['"][\s\S]*?name:\s*['"]([^'"]+)['"][\s\S]*?lastUpdated:\s*['"]([^'"]+)['"]/g;

  let match;
  while ((match = projectRegex.exec(content)) !== null) {
    projects.push({
      id: match[1],
      name: match[2],
      currentDate: match[3],
    });
  }

  return projects;
}

function updateProjectDate(content, projectId, newDate) {
  // Find the project block and update its lastUpdated
  const regex = new RegExp(
    `(id:\\s*['"]${projectId}['"][\\s\\S]*?lastUpdated:\\s*['"])([^'"]+)(['"])`,
    'g'
  );
  return content.replace(regex, `$1${newDate}$3`);
}

async function main() {
  console.log('\n📅 Project Date Updater\n');
  console.log('Checking git repositories for last commit dates...\n');

  let content = readFileSync(projectsPath, 'utf-8');
  const projects = parseProjects(content);

  let updated = false;

  for (const project of projects) {
    const repoInfo = repoMap[project.id];

    if (!repoInfo) {
      console.log(`⚠️  ${project.name}: No repo mapping configured\n`);
      continue;
    }

    const gitDate = repoInfo.type === 'internal'
      ? getGitLastCommitDate(websitesRoot, repoInfo.path.replace(websitesRoot + '/', ''))
      : getGitLastCommitDate(repoInfo.path);

    if (!gitDate) {
      console.log(`⚠️  ${project.name}: Could not get git date from ${repoInfo.path}\n`);
      continue;
    }

    if (gitDate === project.currentDate) {
      console.log(`✓  ${project.name}: Up to date (${project.currentDate})\n`);
      continue;
    }

    console.log(`📦 ${project.name}`);
    console.log(`   Current: ${project.currentDate}`);
    console.log(`   Git:     ${gitDate}`);

    const answer = await question('   [u]pdate / [i]gnore / [m]anual? ');

    switch (answer.toLowerCase().trim()) {
      case 'u':
      case 'update':
        content = updateProjectDate(content, project.id, gitDate);
        console.log(`   ✓ Updated to ${gitDate}\n`);
        updated = true;
        break;

      case 'm':
      case 'manual':
        const manualDate = await question('   Enter date (YYYY-MM-DD): ');
        if (/^\d{4}-\d{2}-\d{2}$/.test(manualDate.trim())) {
          content = updateProjectDate(content, project.id, manualDate.trim());
          console.log(`   ✓ Updated to ${manualDate.trim()}\n`);
          updated = true;
        } else {
          console.log(`   ✗ Invalid date format, skipping\n`);
        }
        break;

      case 'i':
      case 'ignore':
      default:
        console.log(`   - Ignored\n`);
        break;
    }
  }

  if (updated) {
    writeFileSync(projectsPath, content);
    console.log('✅ projects.ts updated\n');
  } else {
    console.log('No changes made.\n');
  }

  rl.close();
}

main().catch((err) => {
  console.error('Error:', err);
  rl.close();
  process.exit(1);
});

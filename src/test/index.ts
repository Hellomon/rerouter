import { rerouter } from '../rerouter';
import { Page, RouteConfig } from '../struct';

// Keep imports minimal to avoid pulling in test frameworks
// Use require to avoid needing Node types in the library build
declare var require: any;
// Allow referencing Node's global without pulling in @types/node
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const global: any;
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

/**
 * Install a Node/Jimp-compatible global.getImageColor for test usage.
 * Jimp always decodes as RGBA.
 */
function installJimpGetImageColor(): void {
  const g: any = (typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : {}) as any;
  if (g) {
    g.getImageColor = (imageData: any, x: number, y: number): RGB => {
      if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) {
        throw new Error('Coordinates are out of bounds.');
      }
      const idx = (imageData.width * y + x) * 4;
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      return { r, g, b };
    };
  }
}

/**
 * Install mock Robotmon-specific global functions for test usage.
 * Only mocks the functions that are actually needed and not already provided.
 */
function installRobotmonGlobals(): void {
  const g: any = (typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : {}) as any;
  if (g) {
    g.getStoragePath = (): string => '/tmp/test-storage';
  }
}

// Auto-install test globals when this module is imported
installJimpGetImageColor();
installRobotmonGlobals();

export type RouteImageFolderTestOptions = {
  // Caller should add all routes to the global rerouter instance inside this callback
  setupRoutes: () => void | Promise<void>;
  // Absolute path to a folder containing .png screenshots to validate
  screenshotsPath: string;
  // Screen rotation used for matching
  rotation?: 'horizontal' | 'vertical';
  // Enable rerouter debug prints
  debug?: boolean;
  // Where to write an aggregated error log; set null to disable writing
  writeErrorLogPath?: string | null;
  // Print per-image progress
  verbose?: boolean;
};

/**
 * Run a generic route-image folder test against current routes in rerouter.
 * Shows warnings for images with no matches, and throws errors for conflicting matches
 * or when the filename doesn't match the matched page/route.
 */
export function runRouteImageFolderTest(options: RouteImageFolderTestOptions): void {
  const { setupRoutes, screenshotsPath, rotation = 'horizontal', debug = false, writeErrorLogPath = 'errorLog.txt', verbose = true } = options;

  // Allow tests to re-run cleanly
  rerouter.reset();
  rerouter.debug = !!debug;

  // Execute route setup (synchronously expected)
  setupRoutes();

  if (!fs.existsSync(screenshotsPath)) {
    throw new Error(`Screenshots directory does not exist: ${screenshotsPath}`);
  }

  const files = fs.readdirSync(screenshotsPath);
  const errorMessages: string[] = [];
  const warningMessages: string[] = [];

  for (const file of files) {
    if (!file.endsWith('.png')) {
      if (verbose) {
        // original log style from legacy routeTest.ts
        console.log(`Skipping non-png file: ${file}`);
      }
      continue;
    }

    const imagePath = path.join(screenshotsPath, file);
    const type = 'image/png';
    const buffer = fs.readFileSync(imagePath);
    const imageData = (Jimp as any).decoders[type](buffer);

    // Access private method for testing purposes
    const matches: { matchedRoute: Required<RouteConfig>; matchedPages: Page[] }[] = (rerouter as any).findMatchedRouteImpl('', imageData, rotation);

    if (matches.length === 0) {
      handleNoMatches(file, warningMessages);
    } else if (matches.length === 1) {
      handleSingleMatch(file, matches[0], errorMessages, verbose);
    } else if (matches.length > 1) {
      handleMultipleMatches(file, matches, errorMessages, verbose);
    }
  }

  // Display warnings
  if (warningMessages.length > 0) {
    console.warn(`Warnings encountered:\n${warningMessages.join('\n')}`);
  }

  // Handle errors
  if (errorMessages.length > 0) {
    if (writeErrorLogPath) {
      try {
        fs.writeFileSync(writeErrorLogPath, errorMessages.join('\n'));
      } catch {}
    }
    throw new Error(`Errors encountered:\n${errorMessages.join('\n')}`);
  }
}

function handleNoMatches(file: string, warningMessages: string[]) {
  warningMessages.push(`No route matches image ${file}`);
}

function handleSingleMatch(file: string, match: { matchedRoute: RouteConfig; matchedPages: Page[] }, errorMessages: string[], verbose: boolean) {
  const matchedRoute: RouteConfig = match.matchedRoute;
  const matchedPages: Page[] = match.matchedPages;

  const fileNameWithoutExtension = path.basename(file, '.png');
  const fileNameWithOnlyFirstName = fileNameWithoutExtension.split('.')[0];
  const routePathWithoutHeadSlash = (matchedRoute.path || '').split('/')[1];
  const isExactMatchPageName = matchedPages.some(page => page.name === fileNameWithOnlyFirstName);
  const isExactMatchRoutePath = routePathWithoutHeadSlash === fileNameWithOnlyFirstName;

  if (isExactMatchPageName || isExactMatchRoutePath) {
    if (verbose) {
      console.log(
        `Exact match found for file: ${file} with the pages [${matchedPages
          .map(function (p) {
            return p.name;
          })
          .join(', ')}] in route ${matchedRoute.path}`
      );
    }
    return;
  }

  const totalPages = matchedRoute.match && 'pages' in matchedRoute.match ? matchedRoute.match.pages.length : 1;
  errorMessages.push(
    `Mismatch: Image file ${file} (expected: ${fileNameWithOnlyFirstName}) matched route ${matchedRoute.path} but only found pages [${matchedPages
      .map(page => page.name)
      .join(', ')}]. Route has ${totalPages} total pages.`
  );
}

function handleMultipleMatches(
  file: string,
  matches: { matchedRoute: Required<RouteConfig>; matchedPages: Page[] }[],
  errorMessages: string[],
  verbose: boolean
) {
  const highToLow = matches.sort((a, b) => b.matchedRoute.priority - a.matchedRoute.priority);
  if (highToLow[0].matchedRoute.priority > highToLow[1].matchedRoute.priority) {
    if (verbose) {
      console.log(`Priority match found for file: ${file} with the highest route ${highToLow[0].matchedRoute}`);
    }
    return;
  }

  const conflictingMatches: string[] = [];

  for (let i = 0; i < highToLow.length; i++) {
    if (highToLow[i].matchedRoute.priority === highToLow[0].matchedRoute.priority) {
      const route = highToLow[i].matchedRoute;
      const pages = highToLow[i].matchedPages;
      conflictingMatches.push(`${route.path} [${pages.map(p => p.name).join(', ')}]`);
    } else {
      break;
    }
  }
  errorMessages.push(`Multiple routes match image ${file}: ${conflictingMatches.join(' vs ')} (all priority ${highToLow[0].matchedRoute.priority})`);
}

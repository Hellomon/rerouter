import { rerouter } from './rerouter';
import { Page, RouteConfig } from './struct';

// Keep imports minimal to avoid pulling in test frameworks
// Use require to avoid needing Node types in the library build
declare var require: any;
// Allow referencing Node's global without pulling in @types/node
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const global: any;
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

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
  // Whether to enforce filename to match either first matched page name or route first path segment
  enforceNameMatch?: boolean;
  // Print per-image progress
  verbose?: boolean;
};

/**
 * Install a Node/Jimp-compatible global.getImageColor for test usage.
 * Jimp always decodes as RGBA.
 */
export function installJimpGetImageColor(): void {
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
 * Run a generic route-image folder test against current routes in rerouter.
 * Throws on error when any image has zero match or conflicting matches, or when
 * enforceNameMatch is true and the filename doesn't match matched page/route.
 */
export function runRouteImageFolderTest(options: RouteImageFolderTestOptions): void {
  const {
    setupRoutes,
    screenshotsPath,
    rotation = 'horizontal',
    debug = false,
    writeErrorLogPath = 'errorLog.txt',
    enforceNameMatch = true,
    verbose = true,
  } = options;

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

  for (const file of files) {
    if (!file.endsWith('.png')) {
      if (verbose) {
        console.log(`[rerouter:test] Skipping non-png file: ${file}`);
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
      if (verbose) {
        console.log(`[rerouter:test] No match for file: ${file}`);
      }
      handleNoMatches(file, errorMessages);
    } else if (matches.length === 1) {
      const matchedRoute = matches[0].matchedRoute;
      const pageNames = matches[0].matchedPages
        .map(function (p) {
          return p.name;
        })
        .join(', ');
      if (verbose) {
        console.log(`[rerouter:test] Matched file: ${file} -> ${matchedRoute.path} [${pageNames}]`);
      }
      handleSingleMatch(file, matches[0], errorMessages, enforceNameMatch);
    } else if (matches.length > 1) {
      if (verbose) {
        var list = matches.map(function (m) {
          return (
            m.matchedRoute.path +
            ' [' +
            m.matchedPages
              .map(function (p) {
                return p.name;
              })
              .join(', ') +
            ']'
          );
        });
        console.log(`[rerouter:test] Multiple matches for file: ${file} -> ${list.join(' | ')}`);
      }
      handleMultipleMatches(file, matches, errorMessages);
    }
  }

  if (errorMessages.length > 0) {
    if (writeErrorLogPath) {
      try {
        fs.writeFileSync(writeErrorLogPath, errorMessages.join('\n'));
      } catch {}
    }
    throw new Error(`Errors encountered:\n${errorMessages.join('\n')}`);
  }
}

function handleNoMatches(file: string, errorMessages: string[]) {
  errorMessages.push(`No matching route found for the image file: ${file}`);
}

function handleSingleMatch(file: string, match: { matchedRoute: RouteConfig; matchedPages: Page[] }, errorMessages: string[], enforceNameMatch: boolean) {
  if (!enforceNameMatch) {
    return;
  }
  const matchedRoute: RouteConfig = match.matchedRoute;
  const matchedPages: Page[] = match.matchedPages;

  const fileNameWithoutExtension = path.basename(file, '.png');
  const fileNameWithOnlyFirstName = fileNameWithoutExtension.split('.')[0];
  const routePathWithoutHeadSlash = (matchedRoute.path || '').split('/')[1];
  const isExactMatchPageName = matchedPages.some(page => page.name === fileNameWithOnlyFirstName);
  const isExactMatchRoutePath = routePathWithoutHeadSlash === fileNameWithOnlyFirstName;

  if (isExactMatchPageName || isExactMatchRoutePath) {
    return;
  }

  errorMessages.push(
    `Mismatch: Image file ${file} did not find an exact path for route ${matchedRoute.path}, which includes pages [${matchedPages
      .map(page => page.name)
      .join(', ')}]` + JSON.stringify({ matchedPages, matchedRoute }, null, 2)
  );
}

function handleMultipleMatches(file: string, matches: { matchedRoute: Required<RouteConfig>; matchedPages: Page[] }[], errorMessages: string[]) {
  const highToLow = matches.sort((a, b) => b.matchedRoute.priority - a.matchedRoute.priority);
  if (highToLow[0].matchedRoute.priority > highToLow[1].matchedRoute.priority) {
    return;
  }

  const conflictingRoutes = [highToLow[0].matchedRoute.path];
  for (let i = 1; i < highToLow.length; i++) {
    if (highToLow[i].matchedRoute.priority === highToLow[0].matchedRoute.priority) {
      conflictingRoutes.push(highToLow[i].matchedRoute.path);
    } else {
      break;
    }
  }
  const errorText = `Multiple matching routes found for the image file: ${file}; Conflicting routes: ${conflictingRoutes.join(', ')}`;
  errorMessages.push(errorText);
}

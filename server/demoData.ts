// SPDX-License-Identifier: GPL-3.0-or-later
import { DEMO_CONSOLES, DEMO_PROFILE, getDemoLibrary } from '../src/data/demoCatalog.ts';

export { DEMO_CONSOLES, DEMO_PROFILE };

export function getDemoCatalog() {
  const lib = getDemoLibrary();
  return {
    recentIds: lib.recentIds,
    popularIds: lib.popularIds,
    recentlyAddedIds: lib.recentlyAddedIds,
    freeToPlayIds: lib.freeToPlayIds,
    ownedIds: lib.ownedIds,
    products: lib.products,
    regions: lib.regions,
  };
}

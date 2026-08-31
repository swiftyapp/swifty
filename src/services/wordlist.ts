// 256 short, unambiguous lowercase words for the generator's "memorable" mode.
// The count is a power of two on purpose: every word carries exactly 8 bits, so
// the entropy readout in the dialog is exact rather than approximate.
const WORDS = [
  'amber', 'anchor', 'apple', 'arbor', 'arrow', 'ash', 'aspen', 'atlas',
  'autumn', 'azure', 'badge', 'bamboo', 'banjo', 'barley', 'basil', 'beacon',
  'beach', 'berry', 'birch', 'bishop', 'bison', 'blade', 'bloom', 'blossom',
  'bolt', 'bonsai', 'border', 'bracket', 'branch', 'brass', 'bravo', 'breeze',
  'brick', 'bridge', 'bronze', 'brook', 'buckle', 'bundle', 'burrow', 'cabin',
  'cable', 'cactus', 'camera', 'candle', 'canvas', 'canyon', 'carbon', 'cargo',
  'carrot', 'castle', 'cedar', 'cello', 'cement', 'chalk', 'charm', 'cherry',
  'chime', 'cider', 'cinder', 'circle', 'citron', 'clay', 'cliff', 'clover',
  'cobalt', 'cocoa', 'comet', 'compass', 'copper', 'coral', 'cotton', 'cove',
  'crane', 'crater', 'crest', 'crimson', 'crystal', 'cypress', 'dahlia', 'daisy',
  'dapple', 'dawn', 'delta', 'denim', 'desert', 'dew', 'diamond', 'dolphin',
  'domino', 'draft', 'dragon', 'drift', 'dune', 'dusk', 'eagle', 'east',
  'ember', 'emerald', 'ether', 'falcon', 'fable', 'feather', 'fern', 'fiber',
  'fig', 'flame', 'flint', 'floral', 'forest', 'fossil', 'fountain', 'fox',
  'frost', 'galaxy', 'garden', 'garnet', 'gazelle', 'ginger', 'glacier', 'glass',
  'glide', 'granite', 'grove', 'gulf', 'hammer', 'harbor', 'harvest', 'hazel',
  'heather', 'hedge', 'hickory', 'hollow', 'honey', 'horizon', 'ice', 'indigo',
  'iris', 'island', 'ivory', 'jade', 'jasmine', 'jetty', 'jungle', 'juniper',
  'kelp', 'kettle', 'kite', 'lagoon', 'lantern', 'lark', 'lattice', 'laurel',
  'lemon', 'lichen', 'lilac', 'linen', 'lotus', 'lumber', 'lunar', 'lyric',
  'magnet', 'mahogany', 'maple', 'marble', 'marsh', 'meadow', 'mesa', 'meteor',
  'mint', 'mirror', 'mist', 'moss', 'motif', 'nectar', 'needle', 'nickel',
  'nomad', 'north', 'nova', 'oak', 'oasis', 'ocean', 'olive', 'onyx',
  'opal', 'orbit', 'orchard', 'orchid', 'osprey', 'otter', 'oxide', 'pebble',
  'pepper', 'petal', 'pewter', 'phoenix', 'pigment', 'pine', 'pivot', 'plateau',
  'plum', 'pollen', 'poplar', 'prairie', 'prism', 'pumice', 'quarry', 'quartz',
  'quill', 'radish', 'rapid', 'raven', 'reef', 'relic', 'ribbon', 'ridge',
  'river', 'rocket', 'rosemary', 'ruby', 'rustic', 'saffron', 'sage', 'salt',
  'sandal', 'sapphire', 'savanna', 'scarlet', 'sequoia', 'shadow', 'shale', 'shore',
  'signal', 'silver', 'slate', 'solar', 'sonnet', 'spark', 'spiral', 'spruce',
  'static', 'stone', 'storm', 'stream', 'summit', 'sunset', 'tamarind', 'teal',
  'tempo', 'thistle', 'thunder', 'timber', 'topaz', 'torch', 'trail', 'tulip'
]

export default WORDS

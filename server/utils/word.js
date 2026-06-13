const words = [
  'apple', 'banana', 'guitar', 'elephant', 'pizza',
  'mountain', 'bicycle', 'umbrella', 'volcano', 'castle',
  'dolphin', 'telescope', 'rainbow', 'spaceship', 'cactus',
  'lighthouse', 'tornado', 'penguin', 'treasure', 'compass',
];

function getRandomWords(count = 3) {
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

module.exports = {
  getRandomWords,
};
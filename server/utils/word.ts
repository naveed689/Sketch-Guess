const words: string[] = [
  'apple', 'banana', 'guitar', 'elephant', 'pizza',
  'mountain', 'bicycle', 'umbrella', 'volcano', 'castle',
  'dolphin', 'telescope', 'rainbow', 'spaceship', 'cactus',
  'lighthouse', 'tornado', 'penguin', 'treasure', 'compass',
];

export function getRandomWords(count: number = 3): string[] {
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
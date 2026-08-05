/** Global FAQs (PRD §6.3), shared by /faq and the homepage FAQ section. */

export interface FaqEntry {
  question: string;
  answer: string;
}

export const globalFaqs: FaqEntry[] = [
  {
    question: 'How do I play party games online with friends?',
    answer:
      'Open any game, create a room, and share the 6-character room code or link. Friends join from their own devices, phones, tablets, or computers, and play starts the moment everyone is in.',
  },
  {
    question: 'Do I need to download anything to play Trivia in Games games?',
    answer:
      'No. Every Trivia in Games game runs in your browser. No downloads, no installs, no plugins.',
  },
  {
    question: 'Can I play Trivia in Games games on my phone?',
    answer:
      'Yes. All games are fully responsive and optimized for touch, including the drawing games and voting games.',
  },
  {
    question: 'Are Trivia in Games games free?',
    answer: 'Yes, all 20 games are free to play. Trivia in Games is supported by advertising.',
  },
  {
    question: 'How many players can join a game?',
    answer:
      'Most rooms support up to 24 players. Voting and solo games work with any group size, from two friends to a full classroom or stream audience.',
  },
  {
    question: 'Do I need to create an account?',
    answer: 'No account needed. Just pick a nickname and join, that’s it.',
  },
  {
    question: 'How do I create a private room?',
    answer:
      'Open a multiplayer game and choose “Create Room.” You’ll get a unique room code and link that only the people you share it with can use.',
  },
  {
    question: 'What are the best party games for large groups?',
    answer:
      'Voting games like Would You Rather and This or That scale to any group size. Guess Who and Trivia also shine with a full room.',
  },
  {
    question: 'Can I play Trivia in Games games with people in different countries?',
    answer:
      'Yes. As long as everyone can reach the website, distance doesn’t matter, the game runs in real time over the internet.',
  },
];

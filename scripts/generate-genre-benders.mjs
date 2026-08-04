#!/usr/bin/env node
/**
 * M15 — Genre-Bender expansion: 70 → 200 entries. Every `bent` is an
 * ORIGINAL Shakespearean-style paraphrase of the song's mood/theme —
 * never the actual lyrics (PRD §13 licensing-safe; D022). Idempotent:
 * existing entries are kept, new ones appended by (original, artist).
 *
 * Run: node scripts/generate-genre-benders.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** [original, artist, year, bent] — 130 new entries. */
const ENTRIES = [
  [
    'Imagine',
    'John Lennon',
    1971,
    'Fancy, if thou canst, a world without division, where no man hoardeth gold nor knoweth war; a dream, yet shared by all, that maketh heaven of this earthly ball.',
  ],
  [
    'Let It Be',
    'The Beatles',
    1970,
    'When troubled times befall thee and the night grows long, take counsel from a gentle mother’s song: whatso shall come, let be, let be, and all shall yet be well.',
  ],
  [
    'Hey Jude',
    'The Beatles',
    1968,
    'Take up the sad refrain and make it thine own, my friend; let not thy burden weigh thee down, but lift a song unto the sky and let the world sing on.',
  ],
  [
    'Yesterday',
    'The Beatles',
    1965,
    'Erewhile my troubles seemed so far away, but now they linger nigh; would that the hours of yesterday could come again, and I were once more free.',
  ],
  [
    'Stairway to Heaven',
    'Led Zeppelin',
    1971,
    'A lady of the realm who thinks all gold is hers espies a stair that climbs unto the clouds; she buys her way with verses, yet finds the road to heaven asks for more.',
  ],
  [
    'Smoke on the Water',
    'Deep Purple',
    1972,
    'A fire fell upon the lake-side hall, and all the air grew thick with smoke; the band stood by the waters, vowing to retell the tale in song.',
  ],
  [
    'Another Brick in the Wall',
    'Pink Floyd',
    1979,
    'The masters of the schoolhouse, cruel and cold, would have us all one brick within their wall; we need no education writ in fear — leave us be, and let the children play.',
  ],
  [
    'Comfortably Numb',
    'Pink Floyd',
    1979,
    'A fever takes the player on the stage; a needle brings him ease, and then the lights, the crowd, the roar — yet he is comfortably numb to all.',
  ],
  [
    'We Will Rock You',
    'Queen',
    1977,
    'Thou wast a boy with mud upon thy face, and now a man with pride upon thy brow; stamp thy foot and clap thy hands, for we shall rock thee yet.',
  ],
  [
    'Another One Bites the Dust',
    'Queen',
    1980,
    'A stealthy hunter stalks the crowded street; his victim falls with scarce a sound. One by one they tumble, and another bites the dust.',
  ],
  [
    'Under Pressure',
    'Queen & David Bowie',
    1981,
    'The city presses down upon us all; love cracks the pavement and the fear of madness rules the day. Yet still we cry out: why can we not give love one more chance?',
  ],
  [
    "Livin' on a Prayer",
    'Bon Jovi',
    1986,
    'A working lad and his true love hold on though the coffers run dry; down on their knees they swear by six-string oaths — we are but half a world from doom, yet we shall make it through.',
  ],
  [
    'Eye of the Tiger',
    'Survivor',
    1982,
    'He riseth from the dust of fallen bouts, his spirit honed by every bitter blow; he hunts the champion with a tiger’s eye, and will not rest until the crown is his.',
  ],
  [
    'Sweet Dreams',
    'Eurythmics',
    1983,
    'Some travel seeking meaning, some must seek it too; some wish to use thee, some would be used by thee. Yet hold the dream aloft, for it is all we truly own.',
  ],
  [
    'Take on Me',
    'A-ha',
    1985,
    'Come, take me by the hand and learn what I would teach; I shall be gone tomorrow, so seize this day, this hour, this fleeting chance to know me true.',
  ],
  [
    'Africa',
    'Toto',
    1982,
    'The rains descend upon the plains of Kilimanjaro as I bless the downpour from above; I seek a wisdom old as time, and all my life I have been waiting for this rain.',
  ],
  [
    'Every Breath You Take',
    'The Police',
    1983,
    'Each breath thou drawest, each step thou takest, each vow thou breakest — I shall be watching, ever near, for thou art mine alone to keep.',
  ],
  [
    'With or Without You',
    'U2',
    1987,
    'I cannot live with thee, nor yet without; thy presence is a glass I cannot see through, and I am caught betwixt the two, bleeding into what I cannot have.',
  ],
  [
    'I Will Always Love You',
    'Whitney Houston',
    1992,
    'If I should stay, I would but be in thy way; so I go, yet carry this vow upon my lips: though we part, my love for thee shall never die.',
  ],
  [
    'I Wanna Dance with Somebody',
    'Whitney Houston',
    1987,
    'When the night is dark and the clock strikes late, I long for a partner to spin me round; some warm and willing soul to dance the hours away with me.',
  ],
  [
    'Respect',
    'Aretha Franklin',
    1967,
    'What thou askest of me, I shall give in kind; but know this, sir: when thou comest home, thou must render unto me my due — a little respect.',
  ],
  [
    'I Will Survive',
    'Gloria Gaynor',
    1978,
    'At first I feared to live, to breathe without thee; but I have learned to stand, to walk, to thrive, and now I flourish, stronger than I ever was before.',
  ],
  [
    'Dancing Queen',
    'ABBA',
    1976,
    'Behold the queen of the night, young and sweet, only seventeen; she danceth with abandon, and all the hall doth envy her grace, for none can match the dancing queen.',
  ],
  [
    'Mamma Mia',
    'ABBA',
    1975,
    'I was undone the moment I saw thee again; my heart breaks loose and sings its old refrain — mamma mia, here I go again, my my, how I have missed thee so.',
  ],
  [
    'Waterloo',
    'ABBA',
    1974,
    'I did surrender unto thee at Waterloo, and like Napoleon I met my fate; yet I confess I could not help but fall, for thou didst win me with a single glance.',
  ],
  [
    'Take a Chance on Me',
    'ABBA',
    1977,
    'If thou art weary of the waiting game, then take a chance on me; I shall be true, I shall be there, for I have naught to lose but all to gain with thee.',
  ],
  [
    'The Winner Takes It All',
    'ABBA',
    1980,
    'The die is cast, the game is done; the winner taketh all and loseth not a tear. I stood beside and watched the prize depart, and yet I cannot hate thee for it.',
  ],
  [
    'September',
    'Earth, Wind & Fire',
    1978,
    'Do you recall the twenty-first night of September? Love was changing the minds of pretenders, and the stars danced as the music played on.',
  ],
  [
    "Stayin' Alive",
    'Bee Gees',
    1977,
    'Whether thou art a man of means or of the street, thou must keep thy head and strut thy beat; for life itself is the prize — I am stayin’ alive.',
  ],
  [
    'YMCA',
    'Village People',
    1978,
    'Young man, there is no need to feel down; I say, young man, lift thyself from the ground. When thou hast no place to rest thy head, the YMCA shall shelter thee.',
  ],
  [
    'Girls Just Want to Have Fun',
    'Cyndi Lauper',
    1983,
    'My mother cometh to me as I play, and asketh when I shall settle down; but when the evening comes, the girls do say: we only wish to have a little fun.',
  ],
  [
    "(I've Had) The Time of My Life",
    'Bill Medley & Jennifer Warnes',
    1987,
    'I have known the time of my life, and ne’er shall I forget; mine eyes have seen the truth in thine, and now I hold the world within my arms.',
  ],
  [
    'Total Eclipse of the Heart',
    'Bonnie Tyler',
    1983,
    'Turn around, bright eyes, and let me see thee once more; we are caught in a total eclipse of the heart, and I am lost without thy light.',
  ],
  [
    'Careless Whisper',
    'George Michael',
    1984,
    'I know thy guilt is written on thy face; a careless whisper hath undone us both. Time can never mend the careless whisper of a broken vow.',
  ],
  [
    'Wake Me Up Before You Go-Go',
    'Wham!',
    1984,
    'Wake me ere thou goest, lest I miss the dance; put on thy glad rags and take my hand, for I would not sleep through the joy of this hour.',
  ],
  [
    'Never Gonna Give You Up',
    'Rick Astley',
    1987,
    'I have known the ways of love and loss, and I am sworn: I shall never give thee up, nor let thee down, nor run away, nor make thee cry.',
  ],
  [
    "Don't Stop Me Now",
    'Queen',
    1978,
    'I am a shooting star, a rocket to the moon; nothing can hold me down this night. Do not stop me now, for I am having such a glorious time.',
  ],
  [
    'Mr. Brightside',
    'The Killers',
    2003,
    'Jealousy consumes me as I fancy scenes I dare not speak; I see them in my mind’s dark eye, and yet I cannot look away from what I fear.',
  ],
  [
    'Viva la Vida',
    'Coldplay',
    2008,
    'I ruled the world of old, my word was law; but now the halls are empty and the crowds are gone. Hear the bells of Saint Peter’s toll for my fallen reign.',
  ],
  [
    'Yellow',
    'Coldplay',
    2000,
    'Look at the stars, how they shine for thee, and all the things they do; I came to thee with trembling heart and wrote thy name in yellow gold.',
  ],
  [
    'Fix You',
    'Coldplay',
    2005,
    'When the light is lost and the tears are spent, when the road is long and the heart is rent, I shall be there to gather thee and, if I can, to fix thee whole.',
  ],
  [
    'Firework',
    'Katy Perry',
    2010,
    'Dost thou not know thou art a firework? Show the world the colors of thy soul and light the sky; thou art worth more than thou canst ever see.',
  ],
  [
    'Roar',
    'Katy Perry',
    2013,
    'I held my tongue and bent to every whim, but now I rise: I have the eye of the tiger, and I shall roar, loud as a lion, and none shall hold me down.',
  ],
  [
    'Dark Horse',
    'Katy Perry',
    2013,
    'They call me a dark horse, a riddle none can read; choose thy words with care, for I am not the gentle lamb they take me for.',
  ],
  [
    'Teenage Dream',
    'Katy Perry',
    2010,
    'Thou makest me feel like a teenage dream, young and wild and free; let us drive until the dawn and live as though the world were ours.',
  ],
  [
    'Party in the USA',
    'Miley Cyrus',
    2009,
    'I flew across the land with but a dream and a guitar; the lights of the city blaze, and I am dancing, feeling right at home in the USA.',
  ],
  [
    'Wrecking Ball',
    'Miley Cyrus',
    2013,
    'I came in like a wrecking ball, I never meant to harm; but all I wanted was to break down every wall between thy heart and mine.',
  ],
  [
    'Flowers',
    'Miley Cyrus',
    2023,
    'I can buy myself flowers, write my name in the sand, and hold my own hand; I have learned to love me better than I loved thee.',
  ],
  [
    'Set Fire to the Rain',
    'Adele',
    2011,
    'I watched thee fall and set fire to the rain; I stood and wept as it burned, for I could not hold thee, and I could not let thee go.',
  ],
  [
    'Hello',
    'Adele',
    2015,
    'Hello from the other side, where I have called a thousand times; they say time heals, but I am not yet whole — forgive me, for I still remember all.',
  ],
  [
    'Easy on Me',
    'Adele',
    2021,
    'Go easy on me, child, I was still a child myself; I had no room to choose, and I have carried the river of my sorrow long enough.',
  ],
  [
    'Skyfall',
    'Adele',
    2012,
    'This is the end, hold thy breath and count to ten; the sky may fall upon us all, but we shall stand together when the world gives way.',
  ],
  [
    'Uptown Girl',
    'Billy Joel',
    1983,
    'She is an uptown girl, who lives in her white-bread world; I am a downtown man who would give the world to take her hand and show her how to live.',
  ],
  [
    'Piano Man',
    'Billy Joel',
    1973,
    'At the corner piano I play for the crowd, and the hours grow long; the patrons raise their glasses and sing along, for music maketh the night bearable.',
  ],
  [
    "We Didn't Start the Fire",
    'Billy Joel',
    1989,
    'We did not start the fire; it burned from ages past and shall burn on. Yet still we fan the flames and sing of all the names the years have known.',
  ],
  [
    'Livin’ la Vida Loca',
    'Ricky Martin',
    1999,
    'She came upon me like a storm, all fire and grace; her lips are devil-red and her world is a whirlwind — and I am living la vida loca with her.',
  ],
  [
    'La Bamba',
    'Ritchie Valens',
    1958,
    'To dance the bamba one must have a little grace; I shall not be the captain, but I shall dance with all my heart, for I am made for this.',
  ],
  [
    'Gasolina',
    'Daddy Yankee',
    2004,
    'She is fire on the dance floor, and she wanteth the gasolina; give her fuel and she shall burn the night away.',
  ],
  [
    'Waka Waka',
    'Shakira',
    2010,
    'The time is come to rise and claim the prize; we are Africa’s children, and we shall fight — waka waka, this time for Africa.',
  ],
  [
    'Chandelier',
    'Sia',
    2014,
    'I swing from the chandelier, a captive of the night; I am holding on for dear life, for I know not how to fall without breaking.',
  ],
  [
    'Cheap Thrills',
    'Sia',
    2016,
    'I need no gold to have my fill of joy; come, dance with me till the morning, for the cheap thrills are the sweetest ones I know.',
  ],
  [
    'Elastic Heart',
    'Sia',
    2013,
    'I have an elastic heart, it bendeth but it breaketh not; thou canst not take what thou didst never give, and I shall rise again from every fall.',
  ],
  [
    'Titanium',
    'Sia & David Guetta',
    2011,
    'Shoot me down with all thy words, but I shall not fall; I am made of titanium, and thy arrows shall but ricochet.',
  ],
  [
    'Counting Stars',
    'OneRepublic',
    2013,
    'Lately I have been counting stars, and finding that I cannot sleep; but I shall take the leap of faith, for everything that kills me makes me feel alive.',
  ],
  [
    "Can't Stop the Feeling",
    'Justin Timberlake',
    2016,
    'I have a feeling in my soul that none can stop; the sun is high and the beat is sweet, and I am dancing with my whole heart.',
  ],
  [
    'SexyBack',
    'Justin Timberlake',
    2006,
    'I am bringing sexy back, to the delight of all; the other fellows do not know how to please, so stand aside and let the master show the way.',
  ],
  [
    'Mirrors',
    'Justin Timberlake',
    2013,
    'Thou art the mirror of my soul; I cannot see myself without thee. Even in the dark, I shall reflect thy light — for thou and I are one.',
  ],
  [
    'Get Lucky',
    'Daft Punk',
    2013,
    'Like the legend of the phoenix, we rise from the ashes of the night; we are up all night to get lucky, for fortune favoureth the bold.',
  ],
  [
    'One More Time',
    'Daft Punk',
    2000,
    'One more time, we are gonna celebrate; let the music play and the night endure, for joy is best when it is shared again and again.',
  ],
  [
    'Stronger',
    'Kanye West',
    2007,
    'What does not kill me maketh me stronger; I have climbed the mountain and I am not yet done, for I rise with every blow.',
  ],
  [
    'Gold Digger',
    'Kanye West',
    2005,
    'She seeketh a man of means, one who can provide the finest things; now I am not sayin’ she a gold digger, but she will not settle for a man of straw.',
  ],
  [
    'Heartless',
    'Kanye West',
    2008,
    'In the night I hear them speak of my cold ways; my heart is frozen, and I cannot feel a thing — so the preacher man preacheth to an empty pew.',
  ],
  [
    'Lose Yourself',
    'Eminem',
    2002,
    'Lose thyself in the moment, for the chance of a lifetime cometh but once; the palms grow sweaty and the knees grow weak, yet thou must seize the mic and not let go.',
  ],
  [
    'Without Me',
    'Eminem',
    2002,
    'Guess who is back, back again; the state of the music hath grown stale without me. I am the one they love to hate, and the industry owes me.',
  ],
  [
    'The Real Slim Shady',
    'Eminem',
    2000,
    'May the real Slim Shady please rise? I am he whom all imitators mimic, yet none can match; I will not leave until the truth is told.',
  ],
  [
    'Stan',
    'Eminem',
    2000,
    'A devoted fan writeth letter after letter, but the replies come not; his devotion curdles into madness, and the tale ends in tragedy upon the bridge.',
  ],
  [
    'Rap God',
    'Eminem',
    2013,
    'I speak with a tongue of lightning, a thousand syllables in a breath; they crown me rap god, and I accept the title with a grin.',
  ],
  [
    'In da Club',
    '50 Cent',
    2003,
    'Go shorty, it is thy birthday; we shall celebrate in the club, where the champagne flows and the night is young.',
  ],
  [
    'Hotline Bling',
    'Drake',
    2015,
    'Thou used to call me on my cellphone late at night when thou didst need my love; now I am but a number on thy screen, and I miss the days when thou didst call.',
  ],
  [
    'One Dance',
    'Drake',
    2016,
    'I need one dance with thee, just one; the night is short and the city hums, so let us move together while the music lasts.',
  ],
  [
    "God's Plan",
    'Drake',
    2018,
    'I have been moving calm and doing well; they wish me ill, but it is God’s plan that I prevail. I give to those in need, for I have been blessed.',
  ],
  [
    'In My Feelings',
    'Drake',
    2018,
    'I am deep in my feelings, and I cannot deny it; Kiki, do you love me? The city knows my heart tonight.',
  ],
  [
    'Sicko Mode',
    'Travis Scott',
    2018,
    'The beat shifts and the night turns wild; I am in sicko mode, riding the wave of chaos, and none can keep the pace.',
  ],
  [
    'HUMBLE.',
    'Kendrick Lamar',
    2017,
    'Sit down, be humble; for all thy boasts and banners, the crown is not yet thine. I have the gold and the grace — now bow thy head.',
  ],
  [
    'DNA.',
    'Kendrick Lamar',
    2017,
    'My DNA is power, my blood is pride; I was born of strength and struggle, and none can strip what runs within my veins.',
  ],
  [
    'Rockstar',
    'Post Malone',
    2017,
    'I am a rockstar, living fast and loud; the good life and the hard life run together, and I would not trade a moment of it.',
  ],
  [
    'Circles',
    'Post Malone',
    2019,
    'We run in circles, chasing what we cannot keep; seasons change, but we are stuck upon this wheel, and I cannot break the loop.',
  ],
  [
    'Sunflower',
    'Post Malone',
    2018,
    'Thou art a sunflower, turning ever toward the light; I know thy heart is true, and I would shelter thee from the storm.',
  ],
  [
    'Levitating',
    'Dua Lipa',
    2020,
    'If thou art feeling like a star, then let me take thee higher; we shall be levitating, floating through the night, for this is my happy place.',
  ],
  [
    "Don't Start Now",
    'Dua Lipa',
    2019,
    'Do not start now, for I have moved on; I have found my stride and my light, and thou shalt not pull me back into the past.',
  ],
  [
    'New Rules',
    'Dua Lipa',
    2017,
    'I have written new rules for mine own heart: do not pick up the phone, do not let him in, for I know how this story endeth.',
  ],
  [
    'Bad Habits',
    'Ed Sheeran',
    2021,
    'My bad habits lead me back to the dark of the night; I know the road is wrong, yet I keep returning to the poison I call mine.',
  ],
  [
    'Perfect',
    'Ed Sheeran',
    2017,
    'I found a love, and I am dancing in the dark with her; she looketh perfect tonight, and I would give her all of me, for she is my perfect.',
  ],
  [
    'Thinking Out Loud',
    'Ed Sheeran',
    2014,
    'When my legs grow weary and my hair turns grey, I shall still love thee; take my hand, and we shall love as we did in our youth.',
  ],
  [
    'Photograph',
    'Ed Sheeran',
    2014,
    'We keep a photograph of every loving hour; though distance parts us, the picture keeps us near, and I shall love thee till the end.',
  ],
  [
    'Watermelon Sugar',
    'Harry Styles',
    2019,
    'Taste the watermelon sugar high; the summer days are sweet, and I want thy company till the evening falls.',
  ],
  [
    'As It Was',
    'Harry Styles',
    2022,
    'The world hath changed and I cannot go back to how it was; I am but a man who misseth the simple days, and I am trying to find my way.',
  ],
  [
    'Sign of the Times',
    'Harry Styles',
    2017,
    'Do not weep, for we are leaving this world behind; these are the signs of the times, and we must be brave enough to start anew.',
  ],
  [
    'Adore You',
    'Harry Styles',
    2019,
    'Walk in thy light, and I shall follow; I would walk a thousand miles across the ocean just to adore thee.',
  ],
  [
    'Stitches',
    'Shawn Mendes',
    2015,
    'Thy words have cut me to the bone, and I am left in stitches; I thought thy love was the cure, but it hath only wounded me more.',
  ],
  [
    'Havana',
    'Camila Cabello',
    2017,
    'My heart is in Havana, where the rhythm never sleeps; I left my home, but half of me remaineth there, calling me back.',
  ],
  [
    'Dynamite',
    'BTS',
    2020,
    'We came to light it up like dynamite, bursting through the night; we are diamonds in the rough, shining for all the world to see.',
  ],
  [
    'Butter',
    'BTS',
    2021,
    'I am smooth like butter, cool like a summer breeze; step aside, for I am about to steal the show with a flick of the wrist.',
  ],
  [
    'DDU-DU DDU-DU',
    'BLACKPINK',
    2018,
    'When I pull the trigger, it goeth ddu-du ddu-du; I am fire and ice, and those who cross me learn the cost of playing with the flame.',
  ],
  [
    'How You Like That',
    'BLACKPINK',
    2020,
    'I have fallen but I rise again, stronger and bolder; look up at me now, for I am back, and I ask: how dost thou like that?',
  ],
  [
    'Kill This Love',
    'BLACKPINK',
    2019,
    'Let us kill this love, for it hath brought us naught but pain; I am done with the sorrow, and I walk away from the flame.',
  ],
  [
    'Pink Venom',
    'BLACKPINK',
    2022,
    'I strike with pink venom, sweet to the eye and deadly to the heart; none can resist, and none can say they were not warned.',
  ],
  [
    'Jai Ho',
    'A. R. Rahman',
    2008,
    'Let the world resound with joy, for I have found my fortune; I have come to claim my destiny — jai ho, victory is mine.',
  ],
  [
    'Kala Chashma',
    'Amitabh Bhattacharya',
    2016,
    'With my black shades I turn the heads of all; I am the talk of the town, and the ladies cannot look away from my swagger.',
  ],
  [
    'Tunak Tunak Tun',
    'Daler Mehndi',
    1998,
    'I dance the tunak tunak tun and the world joins in; my steps are a wonder, and all who see me cannot help but smile.',
  ],
  [
    'Chammak Challo',
    'Vishal-Shekhar',
    2011,
    'She is a chammak challo, a dazzler on the move; I would follow her through the night, for she sets my heart ablaze.',
  ],
  [
    'Munni Badnaam Hui',
    'Lalit Pandit',
    2010,
    'Poor Munni hath earned a wicked name, though she hath done no wrong; the town doth gossip, but she danceth on, unbothered by the tales.',
  ],
  [
    'Chaiyya Chaiyya',
    'A. R. Rahman',
    1998,
    'I walk upon the wind atop the moving train, my heart light as a feather; the shadows part before me — chaiyya chaiyya, I am soaring.',
  ],
  [
    'Gallan Goodiyaan',
    'Shankar–Ehsaan–Loy',
    2014,
    'The friends gather and the gossip flows like wine; we are young and loud, and the night is ours to fill with laughter.',
  ],
  [
    'Badtameez Dil',
    'Pritam',
    2013,
    'My heart is a rascal, refusing to behave; it leapeth at every pretty face and will not listen to reason.',
  ],
  [
    'London Thumakda',
    'Amit Trivedi',
    2014,
    'The bride’s kin dance the London thumakda, showering her with joy and gold; the house shall rock till dawn with the wedding revels.',
  ],
  [
    'Gerua',
    'Pritam',
    2015,
    'I am dyed in the saffron of thy love; call me, and I shall come running through the storm, for my heart is thine alone.',
  ],
  [
    'Kal Ho Naa Ho',
    'Jatin–Lalit',
    2003,
    'Tomorrow may never come, so seize the joy of this very hour; love freely and laugh aloud, for the morrow is not promised.',
  ],
  [
    'Tera Ban Jaunga',
    'Akhil Sachdeva',
    2019,
    'I swear by the sky and the stars: I shall be thine alone; if I have erred, forgive me, for I am but a fool in love.',
  ],
  [
    'Bekhayali',
    'Sachet–Parampara',
    2019,
    'The nights are long with longing for thee; I wander through the city’s empty streets, restless and bereft without thy voice.',
  ],
  [
    'Agar Tum Saath Ho',
    'A. R. Rahman',
    2015,
    'If thou art by my side, the dark roads hold no fear; the night may fall, but with thee I need no lamp to find my way.',
  ],
  [
    'Tum Hi Ho',
    'Mithoon',
    2013,
    'Thou art my everything, my beginning and my end; I breathe but for thee, and I would give the world to hold thee close.',
  ],
  [
    'Channa Mereya',
    'Pritam',
    2016,
    'O my beloved, I have loved thee true, yet fate hath dealt us a cruel hand; let me dance at thy wedding, even as my heart breaketh.',
  ],
  [
    'Kesariya',
    'Pritam',
    2022,
    'Thou art the saffron of my dreams; I ask not for wealth or fame, only that I may love thee in every life to come.',
  ],
  [
    'Lut Gaye',
    'Jubin Nautiyal',
    2021,
    'I have given my all to this love and lost; yet I do not regret the wager, for even in losing I found thee.',
  ],
  [
    'Raataan Lambiyan',
    'Tanishk Bagchi',
    2021,
    'The nights stretch long and sweet with thee; let the hours forget to pass, for I would live in this moment forever.',
  ],
  [
    'Brown Munde',
    'AP Dhillon',
    2020,
    'We are the brown boys from the villages, loud and proud; the world may look down, but we hold our heads high and live our best.',
  ],
  [
    'Excuses',
    'AP Dhillon',
    2020,
    'The excuses grow thin between us; I know thy heart is drifting, and I am left to wonder where we went astray.',
  ],
  [
    'Ranjha',
    'Jasleen Royal',
    2021,
    'I am the Ranjha who wanders for his Heer; our tale is writ in every love song, and I would be thy faithful one till death.',
  ],
  [
    'Pasoori',
    'Ali Sethi & Shae Gill',
    2022,
    'The road between us is long and winding; my heart is a traveler, and I would walk it twice over to reach thee.',
  ],
];

const path = join(root, 'src/data/genre-benders.json');
const existing = JSON.parse(readFileSync(path, 'utf8'));
const seen = new Set(existing.map((entry) => `${entry.original}—${entry.artist}`.toLowerCase()));
let added = 0;
for (const [original, artist, year, bent] of ENTRIES) {
  const key = `${original}—${artist}`.toLowerCase();
  if (seen.has(key)) {
    continue;
  }
  existing.push({ original, artist, bent, year });
  seen.add(key);
  added += 1;
}
writeFileSync(path, JSON.stringify(existing, null, 2) + '\n');
console.log(`genre-benders: ${existing.length} entries (+${added} new)`);

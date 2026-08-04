#!/usr/bin/env node
/**
 * M15 — Genre Swap dataset rewrite. The owner's report: the old descriptions
 * were the ORIGINAL plot with a genre label ("Frozen as horror" was still
 * Frozen). These are genuine reimaginings: the iconic hook survives (so the
 * answer stays guessable), but the STORY clearly diverges.
 *
 * Run: node scripts/generate-genre-swaps.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** [original, genre, description] — 150 entries. */
const ENTRIES = [
  [
    'Harry Potter',
    'haunted house',
    'A night-shift janitor at a cursed boarding school discovers the portraits have been swapping bodies with the students for a century.',
  ],
  [
    'Star Wars',
    'western',
    'A bounty hunter with a laser revolver rides across the desert wasteland, hunting the warlord who stole his father’s lands and his droid.',
  ],
  [
    'Titanic',
    'zombie apocalypse',
    'The maiden voyage of the world’s grandest cruise liner becomes a floating quarantine when the first-class lounge starts serving something that bites back.',
  ],
  [
    'The Lion King',
    'courtroom drama',
    'A cub’s uncle is put on trial for regicide, but the only witness is a meerkat with a habit of breaking the rules of evidence.',
  ],
  [
    'Frozen',
    'horror',
    'A bride’s sister returns from the dead on her wedding night, and every room she walks through is found frozen solid by morning.',
  ],
  [
    'Jurassic Park',
    'zombie apocalypse',
    'An island theme park’s cloned dinosaurs are all dead — except one, and the guests keep turning up hollowed out.',
  ],
  [
    'The Matrix',
    'film noir',
    'A lonely programmer takes one last job from a stranger in a raincoat: find out who erased the city’s memories, and why his own are next.',
  ],
  [
    'Inception',
    'heist film',
    'A team of sleep therapists breaks into a casino magnate’s dreams to steal the combination of a vault that only exists in his subconscious.',
  ],
  [
    'The Godfather',
    'mockumentary',
    'A family-run pasta empire’s eldest son is forced to take over the business after his father’s heart attack — the cameras never leave the kitchen.',
  ],
  [
    'Forrest Gump',
    'space opera',
    'A slow-talking cargo pilot accidentally becomes the hero of three galactic wars while chasing the girl who keeps leaving him voicemails across the stars.',
  ],
  [
    'Toy Story',
    'buddy comedy',
    'Two rival action figures are stranded in a doctor’s waiting room and must bicker their way past a gauntlet of house pets to get home.',
  ],
  [
    'Finding Nemo',
    'western',
    'A widowed fish sets out across the coral frontier to rescue his son from a traveling aquarium show, with only a forgetful outlaw as his guide.',
  ],
  [
    'Shrek',
    'rom-com',
    'A grumpy ogre signs up for a dating show to win the swamp of his dreams, only to fall for the producer who keeps sabotaging his dates.',
  ],
  [
    'The Avengers',
    'superhero saga',
    'When a cosmic artifact lands in New York, five squabbling heroes with matching capes must learn to share the spotlight before the villain does.',
  ],
  [
    'Jaws',
    'horror',
    'A beach town’s lifeguards keep finding empty lifejackets, and the new sheriff starts hearing a song in his sleep — from under the pier.',
  ],
  [
    'E.T.',
    'buddy comedy',
    'A lost alien crash-lands in a suburban garage and teams up with a nervous accountant to crash a neighborhood barbecue before the HOA finds out.',
  ],
  [
    'Back to the Future',
    'western',
    'A teenager’s tricked-out hay wagon accidentally sends him to 1885, where his own grandfather is the town’s most wanted outlaw.',
  ],
  [
    'The Wizard of Oz',
    'superhero saga',
    'A farm girl is chosen by a magical tornado to unite the fractured kingdoms of Oz against the Wicked Witch’s robot army.',
  ],
  [
    'Pulp Fiction',
    'musical',
    'Two hitmen break into a dance-off to retrieve a stolen briefcase, and every scene ends in a synchronized song number.',
  ],
  [
    'The Dark Knight',
    'film noir',
    'A masked vigilante runs the city’s night clubs by day and haunts its rooftops by night, hunting a man who signs his crimes with a playing card.',
  ],
  [
    'Interstellar',
    'western',
    'A widowed farmer rides across a dying Dust Bowl to deliver a message to a colony ship that left Earth without him.',
  ],
  [
    'Coco',
    'haunted house',
    'A boy who can see ghosts inherits his grandmother’s house, where the dead relatives hold a talent contest every Dia de los Muertos.',
  ],
  [
    'Moana',
    'buddy comedy',
    'A village chief’s daughter and a demigod with stage fright set sail to return a stolen crab to its rightful owner before the festival.',
  ],
  [
    'Home Alone',
    'heist film',
    'A family of master thieves leaves their youngest behind during a job, and the boy turns the empty mansion into a trap-filled vault.',
  ],
  [
    'Die Hard',
    'heist film',
    'A cop crashes his brother-in-law’s office Christmas party just as a crew of safe-crackers seals the building to crack the vault below.',
  ],
  [
    'Mean Girls',
    'courtroom drama',
    'A new student’s diary becomes the key exhibit in the trial of the school’s ruling clique, and every witness is a liar.',
  ],
  [
    'The Notebook',
    'zombie apocalypse',
    'A man reads love letters to his wife every day, but each letter describes how he survived a different outbreak to find her again.',
  ],
  [
    'Twilight',
    'horror',
    'A new girl in a rainy town falls for a pale classmate who only eats lunch after dark — and her friends keep disappearing on full moons.',
  ],
  [
    'The Hangover',
    'mockumentary',
    'A camera crew follows four friends through a wedding weekend they can’t remember, one hotel-room mystery at a time.',
  ],
  [
    'Bridesmaids',
    'musical',
    'A broke maid of honor must out-choreograph her rival bridesmaid in a talent show battle for the bride’s attention.',
  ],
  [
    'Superbad',
    'buddy comedy',
    'Two underage friends take on one epic quest to buy a cake for a party, and every adult they meet makes it worse.',
  ],
  [
    'The Social Network',
    'courtroom drama',
    'Two roommates sue each other over who really invented the college’s gossip app, and the depositions are brutal.',
  ],
  [
    'Gladiator',
    'western',
    'A disgraced general rides into the arena circuit to clear his name, but the emperor has put a bounty on his horse.',
  ],
  [
    'Braveheart',
    'space opera',
    'A rebel farmer leads a rebellion against an interstellar empire, shouting freedom into a comms channel that’s always on mute.',
  ],
  [
    'The Terminator',
    'horror',
    'A machine with a human face arrives from the future to erase the woman who will one day build the system that ends humanity.',
  ],
  [
    'Rocky',
    'musical',
    'A debt-collecting boxer gets one shot at the champion, and trains to a medley of songs his corner crew keeps writing for him.',
  ],
  [
    'Casablanca',
    'film noir',
    'An exiled nightclub owner must choose between the woman he lost and the resistance leader hiding in his cellar.',
  ],
  [
    'Gone with the Wind',
    'rom-com',
    'A headstrong plantation owner’s daughter keeps bumping into the same charming rogue at every wedding she crashes.',
  ],
  [
    'Psycho',
    'haunted house',
    'A motel clerk’s mother runs the front desk at night, and every guest who books room 12 never checks out.',
  ],
  [
    'The Silence of the Lambs',
    'musical',
    'A trainee agent must sing duets with a brilliant cannibal to catch a killer who hums while he works.',
  ],
  [
    'Fight Club',
    'buddy comedy',
    'Two insomniac friends start a support group that keeps getting gate-crashed by the same smug guy with great hair.',
  ],
  [
    'The Shawshank Redemption',
    'courtroom drama',
    'A banker framed for murder spends decades filing appeals so meticulous the prison warden starts taking his advice.',
  ],
  [
    'The Green Mile',
    'haunted house',
    'A death-row guard discovers the newest inmate can heal anything — except the warden’s secret.',
  ],
  [
    'Spirited Away',
    'haunted house',
    'A girl takes a wrong turn into a bathhouse for spirits, where her parents are turned into pigs and the boss is a dragon.',
  ],
  [
    'Your Name',
    'rom-com',
    'Two strangers keep waking up in each other’s lives, and every attempt to meet ends with one of them moving house.',
  ],
  [
    'Parasite',
    'zombie apocalypse',
    'A poor family of squatters survives the outbreak by hiding in the rich family’s bunker, one job interview at a time.',
  ],
  [
    'Get Out',
    'horror',
    'A young man visits his girlfriend’s family estate and realizes the staff keep calling him by his great-grandfather’s name.',
  ],
  [
    'The Conjuring',
    'courtroom drama',
    'Two ghost hunters are sued for fraud, and the demon they swore didn’t exist shows up as a surprise witness.',
  ],
  [
    'It',
    'horror',
    'A town’s children keep losing their bikes to a clown that lives in the sewers — and the adults refuse to look down.',
  ],
  [
    'Joker',
    'gritty crime thriller',
    'A failed comedian’s prank calls turn into a citywide manhunt when every punchline he delivers starts coming true.',
  ],
  [
    'Barbie',
    'mockumentary',
    'A documentary crew follows a doll who leaves her dreamhouse to audit a real toy factory, and the workers are not having it.',
  ],
  [
    'Oppenheimer',
    'courtroom drama',
    'The physicist who built the ultimate weapon must defend his legacy in a hearing where every witness contradicts the last.',
  ],
  [
    'Dune',
    'western',
    'A young duke’s heir rides out to the desert planet to settle his father’s debts, but the spice miners have their own law.',
  ],
  [
    'Top Gun',
    'space opera',
    'Two rival fighter pilots compete for a spot on the first orbital squadron, and the final exam is a dogfight with an alien ace.',
  ],
  [
    'Mission Impossible',
    'heist film',
    'A disavowed agent must steal a list from a vault that changes its own combination every sixty seconds.',
  ],
  [
    'Indiana Jones',
    'zombie apocalypse',
    'An archaeologist races a rival to a lost temple, but the artifact he’s after is keeping the tomb’s occupants very busy.',
  ],
  [
    'Pirates of the Caribbean',
    'heist film',
    'A disgraced captain assembles a crew of thieves to steal a ship that can outrun the navy — from the navy’s own harbor.',
  ],
  [
    'Kung Fu Panda',
    'superhero saga',
    'A noodle-serving panda is chosen by prophecy to defeat a villain, but the prophecy was written by his uncle.',
  ],
  [
    'Up',
    'buddy comedy',
    'A grumpy widower and an overeager scout float a house across the city to rescue a bird that stole his mailbox.',
  ],
  [
    'WALL-E',
    'space opera',
    'The last trash-compacting robot on Earth stows away on a starship to save a plant, and the ship’s AI is not a fan.',
  ],
  [
    'Ratatouille',
    'mockumentary',
    'A behind-the-scenes crew follows the most unlikely chef in Paris: a rat who cooks by pulling a sous-chef’s hair.',
  ],
  [
    'Monsters Inc',
    'musical',
    'The scariest monster in the factory is forced into a talent show to fund the scream machine, and his partner can’t sing.',
  ],
  [
    'Inside Out',
    'space opera',
    'Five tiny emotion pilots navigate a spaceship crewed by a single teenager, and headquarters keeps mutinying.',
  ],
  [
    'Soul',
    'film noir',
    'A jazz pianist dies and wakes up in a detective’s body, chasing the thief who stole his life — himself.',
  ],
  [
    'Encanto',
    'superhero saga',
    'In a magical house, every grandchild gets a power except one — until the house starts failing and only she can save it.',
  ],
  [
    'Zootopia',
    'film noir',
    'A rabbit cop and a fox con artist work the night beat in a city where the predators have gone missing, one precinct at a time.',
  ],
  [
    'Despicable Me',
    'heist film',
    'A washed-up villain plans his greatest heist: stealing the moon, but only to impress the three orphans he accidentally adopted.',
  ],
  [
    'Minions',
    'space opera',
    'Three yellow henchmen hitchhike across the galaxy looking for the worst boss in the universe to serve.',
  ],
  [
    'Sing',
    'mockumentary',
    'A koala with a failing theater hosts a talent contest, and the cameras capture every disastrous audition.',
  ],
  [
    'Trolls',
    'buddy comedy',
    'Two rival creatures with very different hair must work together to rescue their friends from a chef who hates music.',
  ],
  [
    'Boss Baby',
    'heist film',
    'A suit-wearing baby and his resentful older brother plot to steal the parents’ attention from a rival newborn.',
  ],
  [
    'Paddington',
    'rom-com',
    'A polite bear from Peru moves to London and keeps accidentally setting up his neighbors on disastrous dates.',
  ],
  [
    'Willy Wonka',
    'horror',
    'Five children win a tour of a chocolate factory where the staff never speak and the candy tastes like memories you’d rather forget.',
  ],
  [
    'Charlie and the Chocolate Factory',
    'musical',
    'A poor boy’s golden ticket earns him a tour where every room breaks into song and the Oompa Loompas know all the choreography.',
  ],
  [
    'The Hunger Games',
    'gritty crime thriller',
    'A district girl volunteers for a televised survival contest, but this year the gamemakers have rigged the odds — against the sponsors.',
  ],
  [
    'Divergent',
    'superhero saga',
    'A girl who doesn’t fit any faction must hide her ability while a power-hungry leader tests the whole city for obedience.',
  ],
  [
    'Maze Runner',
    'zombie apocalypse',
    'Teenagers wake up in a walled compound with no memories, and the creatures in the maze are the least of their problems.',
  ],
  [
    'Fifty Shades',
    'rom-com',
    'A young journalist interviews a mysterious businessman, and every meeting ends with a contract neither of them reads.',
  ],
  [
    'Crazy Rich Asians',
    'rom-com',
    'A professor meets her boyfriend’s family at a wedding in Singapore, and his mother has already planned her replacement.',
  ],
  [
    'La La Land',
    'film noir',
    'A jazz pianist and an aspiring actress keep crossing paths at the same failing club, each one lying about their big break.',
  ],
  [
    'Whiplash',
    'horror',
    'A drum student’s teacher knows every note he plays before he plays it, and the rehearsal room grows teeth at midnight.',
  ],
  [
    'Birdman',
    'superhero saga',
    'A washed-up action star becomes an actual superhero when the bird costume he refuses to wear starts following him.',
  ],
  [
    'Spotlight',
    'gritty crime thriller',
    'A city’s investigative team has six months to crack the story everyone in the building has been paid to ignore.',
  ],
  [
    '12 Years a Slave',
    'western',
    'A free man is tricked onto a wagon and sold at a frontier auction, then rides for a decade to find his way home.',
  ],
  [
    'The Revenant',
    'zombie apocalypse',
    'A fur trapper left for dead crawls through a frozen wilderness where the dead keep getting back up behind him.',
  ],
  [
    'Mad Max',
    'western',
    'A road warrior with a bad knee and a worse car is the last courier between two warring fuel towns.',
  ],
  [
    'John Wick',
    'western',
    'A retired assassin rides back into town after someone takes his dog, and the saloon runs out of deputies.',
  ],
  [
    'Fast and Furious',
    'heist film',
    'An undercover cop joins a crew of street racers to steal a shipment of engines, but the crew is planning the same job.',
  ],
  [
    'Transformers',
    'space opera',
    'Giant alien machines arrive on Earth and choose a teenager to broker peace between the car faction and the jet faction.',
  ],
  [
    'Pacific Rim',
    'superhero saga',
    'Two pilots who can’t stand each other are forced to share a giant robot to fight kaiju rising from the sea.',
  ],
  [
    'Godzilla',
    'superhero saga',
    'A city’s defense force builds a giant robot to stop the monster, but the monster keeps saving the city from worse things.',
  ],
  [
    'King Kong',
    'mockumentary',
    'A film crew documents the capture of a giant ape, and the director’s ego is the real monster.',
  ],
  [
    'Planet of the Apes',
    'horror',
    'Astronauts crash-land on a world where apes rule and humans are hunted — and the apes are very, very polite about it.',
  ],
  [
    'X-Men',
    'courtroom drama',
    'Mutant students testify before a committee deciding their fate, and the prosecutor is one of their own.',
  ],
  [
    'Spider-Man',
    'gritty crime thriller',
    'A photographer with a secret identity covers a crime wave he caused, and the editor is getting suspicious of his deadlines.',
  ],
  [
    'Black Panther',
    'superhero saga',
    'A hidden kingdom’s new king must defend his throne from a cousin raised in the outside world with a grudge and a vibranium suit.',
  ],
  [
    'Wonder Woman',
    'space opera',
    'An Amazonian warrior is recruited by an interstellar alliance to bring a war criminal back from a planet of gods.',
  ],
  [
    'Aquaman',
    'superhero saga',
    'A lighthouse keeper’s son with gills is summoned to claim a trident from the ocean kingdom that exiled his mother.',
  ],
  [
    'Guardians of the Galaxy',
    'space opera',
    'Five criminals who hate each other must hold hands to stop a fanatic from unmaking the universe with a glowing stone.',
  ],
  [
    'Deadpool',
    'rom-com',
    'A disfigured mercenary who can’t die keeps trying to plan the perfect date, but the universe keeps exploding around him.',
  ],
  [
    'Logan',
    'western',
    'An aging mutant drives a broken-down truck across the border to deliver a girl who may be the last of her kind.',
  ],
  [
    'Venom',
    'buddy comedy',
    'A disgraced journalist shares a body with an alien who only wants two things: chocolate and to be liked.',
  ],
  [
    'Jumanji',
    'superhero saga',
    'A cursed board game transports four students into a jungle where they inherit powers they don’t understand and can’t return.',
  ],
  [
    'Zathura',
    'space opera',
    'Two siblings find a board game that launches their house into an asteroid field with every roll of the dice.',
  ],
  [
    'Night at the Museum',
    'haunted house',
    'A night guard discovers the exhibits come alive after hours, and the dinosaur skeleton has been stealing his lunch.',
  ],
  [
    'The Parent Trap',
    'buddy comedy',
    'Twin sisters who don’t know each other meet at summer camp and swap lives to reunite their divorced parents.',
  ],
  [
    'Freaky Friday',
    'rom-com',
    'A mother and daughter swap bodies the morning of the mother’s wedding, and the daughter must plan it.',
  ],
  [
    'Clueless',
    'mockumentary',
    'A camera crew follows the most popular girl in high school as she tries to improve a new student’s life with disastrous results.',
  ],
  [
    'Legally Blonde',
    'courtroom drama',
    'A fashion major enrolls in law school to win back her ex and ends up running the defense in a murder trial.',
  ],
  [
    'The Devil Wears Prada',
    'horror',
    'A journalism graduate’s new boss can smell fear and has a collection of assistants’ career dreams in a locked drawer.',
  ],
  [
    'The Proposal',
    'rom-com',
    'A Canadian editor faces deportation and blackmails her assistant into a sham engagement, then his family plans a huge wedding.',
  ],
  [
    '27 Dresses',
    'zombie apocalypse',
    'A perpetual bridesmaid survives the outbreak by planning weddings for survivors, and the groom is her sister’s ex.',
  ],
  [
    'How to Lose a Guy in 10 Days',
    'zombie apocalypse',
    'A journalist testing relationship-killers and a man betting he can make her fall for him are the last two people in a quarantined city.',
  ],
  [
    'Notting Hill',
    'rom-com',
    'A bookshop owner’s quiet life is upended when the world’s most famous actress keeps coming in to hide from her fans.',
  ],
  [
    'Love Actually',
    'zombie apocalypse',
    'Eight Londoners’ love lives collide during a blackout, and the outbreak is just another obstacle to the Christmas show.',
  ],
  [
    'Four Weddings and a Funeral',
    'zombie apocalypse',
    'A serial guest keeps meeting the same woman at weddings, funerals, and now quarantine checkpoints.',
  ],
  [
    'Bridget Jones',
    'zombie apocalypse',
    'A diarist documenting her disastrous love life survives the outbreak by writing an advice column no one follows.',
  ],
  [
    'Mamma Mia',
    'musical',
    'A bride invites three possible fathers to her wedding on a Greek island, and the whole island joins in song.',
  ],
  [
    'Grease',
    'musical',
    'A summer romance turns complicated when the good girl transfers to the bad boy’s high school and they pretend not to know each other.',
  ],
  [
    'Dirty Dancing',
    'musical',
    'A resort guest’s daughter is taught to dance by the summer staff, and her father has very strong opinions about the final number.',
  ],
  [
    'Footloose',
    'musical',
    'A city kid moves to a town where dancing is banned and decides to throw a prom anyway.',
  ],
  [
    'Flashdance',
    'musical',
    'A welder who dances at night auditions for a ballet company that doesn’t know how she spends her days.',
  ],
  [
    'Saturday Night Fever',
    'film noir',
    'A record-store clerk by day and dance-floor king by night gets drawn into a smuggling ring through a disco contact.',
  ],
  [
    'The Princess Bride',
    'western',
    'A farm boy rides out to rescue his true love from a wedding she doesn’t want, with a giant and a swordsman for company.',
  ],
  [
    'Ghostbusters',
    'buddy comedy',
    'Three fired scientists start a pest-control business for the afterlife and get sued by the city when the mayor’s office is haunted.',
  ],
  [
    'The Breakfast Club',
    'courtroom drama',
    'Five students from different cliques serve Saturday detention, and the principal’s case against each of them falls apart one confession at a time.',
  ],
  [
    'Groundhog Day',
    'film noir',
    'A cynical weatherman is stuck reliving the same day, and every version of the town has a different crime for him to solve.',
  ],
  [
    'The Goonies',
    'heist film',
    'A group of kids finds an old pirate map and plans a heist to save their houses from foreclosure before the bank opens.',
  ],
  [
    'Alien',
    'space opera',
    'The crew of a mining ship answers a distress call and brings back a passenger that keeps reproducing in the vents.',
  ],
  [
    'The Exorcist',
    'haunted house',
    'A priest is called to a house where the girl in the attic speaks in languages she never learned and knows everyone’s secrets.',
  ],
  [
    'The Sixth Sense',
    'haunted house',
    'A child psychologist takes on a new patient who keeps telling him what his dead clients would have said.',
  ],
  [
    'Scream',
    'horror',
    'A masked killer is picking off students who know the rules of horror movies, and the new girl wrote the book on them.',
  ],
  [
    'Halloween',
    'gritty crime thriller',
    'A masked killer escapes on the night of the town’s harvest festival and a babysitter is the only one who noticed.',
  ],
  [
    'The Truman Show',
    'mockumentary',
    'A man discovers his entire life is a documentary, and the cameras follow him as he tries to leave the set.',
  ],
  [
    'Cast Away',
    'buddy comedy',
    'A package-delivery executive stranded on an island turns his only companion — a volleyball — into a demanding roommate.',
  ],
  [
    'The Karate Kid',
    'superhero saga',
    'A bullied teen learns martial arts from a mysterious handyman with a secret past and a very specific waxing technique.',
  ],
  [
    'The Incredibles',
    'courtroom drama',
    'A family of retired superheroes is sued for vigilantism and must testify, then suit up anyway when the court is attacked.',
  ],
  [
    'The Little Mermaid',
    'film noir',
    'A mermaid princess trades her voice for legs to investigate a shipping magnate who’s been dumping secrets in her reef.',
  ],
  [
    'Aladdin',
    'heist film',
    'A street thief finds a lamp that grants him three wishes, and uses the first to rob the palace vault.',
  ],
  [
    'Beauty and the Beast',
    'haunted house',
    'A bookish woman is trapped in a castle where the servants are furniture and the master is a beast who reads her letters.',
  ],
  [
    'The Sound of Music',
    'haunted house',
    'A governess arrives at a villa where the children sing in the walls and the captain forbids music — for a reason.',
  ],
  [
    'Mary Poppins',
    'mockumentary',
    'A nanny with impossible powers takes a job with a banker’s family and the neighborhood documentary crew can’t explain a single thing.',
  ],
  [
    'Goodfellas',
    'gritty crime thriller',
    'A kid who idolized the neighborhood crew grows up inside it, and the life is a lot less glamorous in the retelling.',
  ],
  [
    'Scarface',
    'gritty crime thriller',
    'A refugee with a big dream and a bigger temper climbs a criminal empire with a chainsaw and a hand grenade.',
  ],
  [
    'Reservoir Dogs',
    'gritty crime thriller',
    'A jewelry heist goes wrong and the surviving crew holes up in a warehouse, each one sure the other is the rat.',
  ],
  [
    'Se7en',
    'gritty crime thriller',
    'Two detectives chase a killer who leaves each victim staged as a lesson, and the city is starting to agree with him.',
  ],
  [
    'The Departed',
    'gritty crime thriller',
    'A mole inside the police and a mole inside the mob are hunting each other, and both report to the same shrink.',
  ],
  [
    "Schindler's List",
    'courtroom drama',
    'A factory owner is put on trial for saving his workers, and the prosecution keeps losing witnesses to memory.',
  ],
  [
    'Saving Private Ryan',
    'courtroom drama',
    'A squad ordered to bring one soldier home must justify every life spent on the mission in a military tribunal.',
  ],
  [
    'Slumdog Millionaire',
    'gritty crime thriller',
    'A street kid who wins a game show is accused of cheating, and every answer turns out to be a crime he survived.',
  ],
];

const output = ENTRIES.map(([original, genre, description]) => ({ original, genre, description }));

// Preserve the original dataset's order so diffs stay readable.
const existing = JSON.parse(readFileSync(join(root, 'src/data/genre-swaps.json'), 'utf8'));
const byOriginal = new Map(output.map((entry) => [entry.original, entry]));
const merged = existing.map((entry) => byOriginal.get(entry.original) ?? entry);

writeFileSync(join(root, 'src/data/genre-swaps.json'), JSON.stringify(merged, null, 2) + '\n');
console.log(`genre-swaps: ${merged.length} entries rewritten (${output.length} new descriptions)`);

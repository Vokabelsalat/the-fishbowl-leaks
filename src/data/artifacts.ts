import type { ExhibitionArtifact } from "@/types/exhibition";

type VisualFamily = Pick<ExhibitionArtifact, "posterImageSrc">;

const visualFamilies: Record<"memory" | "machine" | "body", VisualFamily> = {
  memory: {
    posterImageSrc: "/images/melting-eye.jpeg",
  },
  machine: {
    posterImageSrc: "/images/eye.jpeg",
  },
  body: {
    posterImageSrc: "/images/hands.jpeg",
  },
};

type ArtifactSource = Omit<
  ExhibitionArtifact,
  | "posterImageSrc"
  | "marineType"
  | "classification"
  | "visualTraits"
  | "stateEffects"
  | "storylet"
  | "choice"
> & {
  visualFamily: keyof typeof visualFamilies;
};

type AquariumLayer = Pick<
  ExhibitionArtifact,
  | "marineType"
  | "classification"
  | "visualTraits"
  | "stateEffects"
  | "storylet"
  | "choice"
>;

const aquariumLayers: Record<string, AquariumLayer> = {
  "finding-frida": {
    marineType: "archive coral",
    classification: "Phototrophic memory colony",
    visualTraits: ["photograph scales", "woven roots"],
    stateEffects: { memory: 2, openness: 1, coherence: -1 },
    storylet:
      "A photograph sank into the substrate. By morning, it had grown roots.",
    choice: {
      prompt: "The archive is beginning to grow.",
      options: [
        {
          id: "tend",
          label: "Tend the roots",
          effects: { memory: 2, openness: 1 },
        },
        {
          id: "leave",
          label: "Let them wander",
          effects: { openness: 2, coherence: -1 },
        },
      ],
    },
  },
  "historically-yours": {
    marineType: "synthetic jellyfish chorus",
    classification: "Speculative voice cluster",
    visualTraits: ["transcript tentacles", "borrowed voices"],
    stateEffects: { voice: 2, coherence: -1, memory: 1 },
    storylet:
      "Three voices drifted up from the underworld. None would confirm its identity.",
    choice: {
      prompt: "A voice is coming from inside the jellyfish.",
      options: [
        { id: "listen", label: "Listen", effects: { voice: 2, memory: 1 } },
        {
          id: "question",
          label: "Question it",
          effects: { agency: 2, coherence: -1 },
        },
      ],
    },
  },
  "from-ingrid-to-bergen": {
    marineType: "ghost current",
    classification: "Long-duration remembrance tide",
    visualTraits: ["forest current", "vanishing photographs"],
    stateEffects: { memory: 2, openness: 1, coherence: -1 },
    storylet:
      "A current crossed nineteen years without deciding where the past ended.",
    choice: {
      prompt: "Something disappeared from the archive.",
      options: [
        {
          id: "reconstruct",
          label: "Reconstruct it",
          effects: { memory: 2, coherence: 1 },
        },
        {
          id: "gap",
          label: "Leave the gap",
          effects: { openness: 2, coherence: -2 },
        },
      ],
    },
  },
  "your-update-has-failed": {
    marineType: "uncorrectable organism",
    classification: "Persistent system anomaly",
    visualTraits: ["failed progress bar", "glitch skin"],
    stateEffects: { agency: 2, openness: 2, coherence: -2 },
    storylet:
      "The tank attempted an update. The organism survived every correction.",
    choice: {
      prompt: "The aquarium detected an irregular organism.",
      options: [
        {
          id: "correct",
          label: "Correct it",
          effects: { coherence: 2, openness: -2 },
        },
        {
          id: "change",
          label: "Let it change",
          effects: { agency: 2, openness: 2, coherence: -1 },
        },
      ],
    },
  },
  "grand-hotel-bald-cockatoo": {
    marineType: "fortune-bearing nestfish",
    classification: "Oneiric recombination species",
    visualTraits: ["printed fortunes", "dream plumage"],
    stateEffects: { openness: 2, coherence: -2, voice: 1 },
    storylet:
      "A hotel nested inside the tank and printed a fortune for the tide.",
    choice: {
      prompt: "The manager offers a future in two pieces.",
      options: [
        {
          id: "keep",
          label: "Keep the fortune",
          effects: { memory: 2, coherence: 1 },
        },
        {
          id: "shuffle",
          label: "Shuffle it",
          effects: { openness: 2, coherence: -2 },
        },
      ],
    },
  },
  "glass-like-fabric": {
    marineType: "refractive skin",
    classification: "Unresolved surface animal",
    visualTraits: ["glass fins", "folded interface"],
    stateEffects: { openness: 1, coherence: -1, agency: 1 },
    storylet:
      "The surface folded. For a moment, the glass forgot which side was inside.",
    choice: {
      prompt: "The surface asks to be touched.",
      options: [
        {
          id: "press",
          label: "Press closer",
          effects: { agency: 1, coherence: 1 },
        },
        {
          id: "fold",
          label: "Fold the surface",
          effects: { openness: 2, coherence: -1 },
        },
      ],
    },
  },
  "between-page-and-screen": {
    marineType: "letter-exchanging pair",
    classification: "Amphibious correspondence",
    visualTraits: ["QR shells", "anagram scales"],
    stateEffects: { voice: 2, openness: 1, coherence: -1 },
    storylet: "P sent a letter through the glass. S answered from the water.",
    choice: {
      prompt: "A letter is floating between page and screen.",
      options: [
        {
          id: "read",
          label: "Read it aloud",
          effects: { voice: 2, coherence: 1 },
        },
        {
          id: "reply",
          label: "Rearrange the reply",
          effects: { agency: 1, coherence: -2 },
        },
      ],
    },
  },
  "bybanen-slop-surfer": {
    marineType: "synthetic city ray",
    classification: "Algorithmic urban mimic",
    visualTraits: ["repeated skyline", "slop wake"],
    stateEffects: { agency: 1, coherence: -2, openness: 1 },
    storylet: "Bergen repeated itself until the copy learned how to surf.",
    choice: {
      prompt: "The city has been flattened into a cheerful current.",
      options: [
        {
          id: "ride",
          label: "Ride the copy",
          effects: { openness: 2, agency: 1 },
        },
        {
          id: "interrupt",
          label: "Interrupt the loop",
          effects: { agency: 2, coherence: -1 },
        },
      ],
    },
  },
  emperor: {
    marineType: "aphasic deep-sea signal",
    classification: "Partially legible interior current",
    visualTraits: ["hand-drawn terrain", "quiet waveform"],
    stateEffects: { memory: 1, voice: -1, openness: 1 },
    storylet:
      "A word descended beyond reach. A hand-drawn light followed it down.",
    choice: {
      prompt: "A word is present, but will not surface.",
      options: [
        {
          id: "wait",
          label: "Wait with it",
          effects: { memory: 1, openness: 2 },
        },
        {
          id: "gesture",
          label: "Answer with a gesture",
          effects: { agency: 1, voice: 1 },
        },
      ],
    },
  },
  "grand-hotel-galactic-center": {
    marineType: "orbital hotel current",
    classification: "Interstellar hospitality form",
    visualTraits: ["orbit rings", "distant signals"],
    stateEffects: { openness: 2, voice: 1, coherence: -1 },
    storylet:
      "A corridor opened onto another sea. The vacancy sign began to orbit.",
    choice: {
      prompt: "A distant room is transmitting through the water.",
      options: [
        {
          id: "enter",
          label: "Enter the room",
          effects: { openness: 2, agency: 1 },
        },
        {
          id: "signal",
          label: "Return the signal",
          effects: { voice: 2, memory: 1 },
        },
      ],
    },
  },
  "her-name-was-gisberta": {
    marineType: "memorial light current",
    classification: "Uncontained act of witness",
    visualTraits: ["central light", "resistant tide"],
    stateEffects: { memory: 2, agency: 2, voice: 1 },
    storylet:
      "The water held a name carefully. The system called this an error in forgetting.",
    choice: {
      prompt: "A name remains lit beneath the surface.",
      options: [
        {
          id: "witness",
          label: "Stay and witness",
          effects: { memory: 2, voice: 1 },
        },
        {
          id: "carry",
          label: "Carry it onward",
          effects: { agency: 2, openness: 1 },
        },
      ],
    },
  },
  goliath: {
    marineType: "networked deep-sea giant",
    classification: "Plural-reality social organism",
    visualTraits: ["multiplayer nodes", "reality comb"],
    stateEffects: { openness: 2, voice: 2, coherence: -1 },
    storylet:
      "A solitary giant found a network. The dark filled with other players.",
    choice: {
      prompt: "A signal is waiting beyond the isolated trench.",
      options: [
        {
          id: "connect",
          label: "Join the network",
          effects: { voice: 2, openness: 1 },
        },
        {
          id: "explore",
          label: "Enter another reality",
          effects: { openness: 2, coherence: -1 },
        },
      ],
    },
  },
  "land-of-crystals": {
    marineType: "archive crystal reef",
    classification: "Synthetic remembrance mineral",
    visualTraits: ["faceted archive", "borrowed voice"],
    stateEffects: { memory: 2, voice: 1, coherence: -1 },
    storylet:
      "A lost studio returned as crystal, carrying a voice that never survived.",
    choice: {
      prompt: "The crystal is holding a fragment of the past.",
      options: [
        {
          id: "preserve",
          label: "Preserve it",
          effects: { memory: 2, coherence: 1 },
        },
        {
          id: "refract",
          label: "Refract it",
          effects: { openness: 2, coherence: -1 },
        },
      ],
    },
  },
  "grand-hotel-sand-fountain": {
    marineType: "hourglass current",
    classification: "Recombinant memory fountain",
    visualTraits: ["falling sand", "haunted fragments"],
    stateEffects: { memory: 2, openness: 2, coherence: -1 },
    storylet:
      "Sand carried three stories through the hotel, rearranging them as it fell.",
    choice: {
      prompt: "The fountain is releasing a memory.",
      options: [
        {
          id: "hold",
          label: "Hold the fragment",
          effects: { memory: 2, coherence: 1 },
        },
        {
          id: "release",
          label: "Let it recombine",
          effects: { openness: 2, coherence: -1 },
        },
      ],
    },
  },
  "fiery-sparks-of-light": {
    marineType: "holographic spark school",
    classification: "Volumetric language bloom",
    visualTraits: ["poem sparks", "hologram wake"],
    stateEffects: { voice: 2, agency: 1, openness: 1 },
    storylet:
      "Four voices entered the water as sparks and made language visible.",
    choice: {
      prompt: "A spoken line is beginning to glow.",
      options: [
        {
          id: "kindle",
          label: "Kindle the words",
          effects: { voice: 2, agency: 1 },
        },
        {
          id: "share",
          label: "Share the light",
          effects: { openness: 2, voice: 1 },
        },
      ],
    },
  },
  "fishbowl-leaks": {
    marineType: "leaking aquarium shoal",
    classification: "Participatory narrative ecosystem",
    visualTraits: ["cracked glass scales", "escaping bubbles"],
    stateEffects: { openness: 2, agency: 1, coherence: -1 },
    storylet:
      "The tank was sorted into tidy partitions. One crack later, every species was swimming together.",
    choice: {
      prompt: "The glass of the aquarium is starting to crack.",
      options: [
        {
          id: "seal",
          label: "Keep the tank sealed",
          effects: { coherence: 2, memory: 1 },
        },
        {
          id: "leak",
          label: "Let it leak",
          effects: { openness: 2, agency: 1 },
        },
      ],
    },
  },
  "realidad-mitigada": {
    marineType: "barcoded moon jelly",
    classification: "Mitigated reality drifter",
    visualTraits: ["barcode stripes", "sticker spots"],
    stateEffects: { voice: 2, agency: 1, openness: 1 },
    storylet:
      "A violet moon rose behind the bars of a barcode. By morning, pieces of the sea were stuck to walls far outside the tank.",
    choice: {
      prompt: "Someone is sticking pieces of the sea outside the glass.",
      options: [
        {
          id: "peel",
          label: "Peel them off",
          effects: { coherence: 2, voice: -1 },
        },
        {
          id: "spread",
          label: "Pass them on",
          effects: { agency: 2, openness: 1 },
        },
      ],
    },
  },
};

const exhibitionSources: ArtifactSource[] = [
  {
    id: "finding-frida",
    exhibitionId: 1,
    targetIndex: 0,
    title: "Finding Frida",
    artist: "Hilde K. Kjøs",
    visualFamily: "memory",
    particleForm: "torus",
    color: "#356B4B",
    alternativeColor: "#245137",
    theme: "memory",
    shortText:
      "Finding Frida is a documentary VR experience where past and present intertwine in an exploration of art, family and the power of human creativity. Photorealistic 3D scans, dreamlike projections and animated artwork blend with a soundscape of reworked foley and an original musical score. Voice-over drawn from interviews with Frida Hansen and contemporary historical sources seeks authenticity within a dreamlike world while shedding new light on a forgotten female artist. Central to the work is the value of role models, and how VR allows resonance to travel back and forth through time.",
    narrativeWords: ["remember", "archive", "return", "resonate"],
    creaturePart: {
      id: "memory-crown",
      label: "Memory scales",
      description:
        "Iridescent scales for carrying images between past and present.",
    },
  },
  {
    id: "historically-yours",
    exhibitionId: 2,
    targetIndex: 1,
    title: "Historically Yours",
    artist: "Lina Harder",
    visualFamily: "memory",
    particleForm: "triad",
    color: "#6C3F61",
    alternativeColor: "#5A2F4F",
    theme: "memory",
    shortText:
      "Historically Yours is an interactive podcast broadcasting from the Underworld. Visitors send a question or grievance to three fictional hosts inspired by Cleopatra, Marie Antoinette and Henrietta Swan Leavitt. AI turns each contribution into a conversation spoken by persuasive synthetic voices, asking who gets to represent the past and why approximations are so easy to believe.",
    narrativeWords: ["remember", "record", "revisit", "inherit"],
    creaturePart: {
      id: "archive-ears",
      label: "Archive gills",
      description: "Frilled gills tuned to voices that history almost lost.",
    },
  },
  {
    id: "from-ingrid-to-bergen",
    exhibitionId: 3,
    targetIndex: 2,
    title: "From Ingrid to Bergen",
    artist: "Pedro Velho",
    visualFamily: "memory",
    particleForm: "tree",
    color: "#597D8C",
    alternativeColor: "#365E6D",
    theme: "memory",
    shortText:
      "From Ingrid to Bergen is an interactive documentary about grief, memory, theatre and the technologies used to maintain relationships with what is no longer there. Personal archives, photographs, paintings, videos and texts from nineteen years form a shifting map of loss and reconstruction.",
    narrativeWords: ["trace", "route", "carry", "return"],
    creaturePart: {
      id: "route-tail",
      label: "Ribbon tail",
      description: "A streaming tail that remembers every turn in the route.",
    },
  },
  {
    id: "your-update-has-failed",
    exhibitionId: 4,
    targetIndex: 3,
    title: "Your Update Has Failed",
    artist: "Sérgio Galvão Roxo",
    visualFamily: "machine",
    particleForm: "cuboid",
    color: "#79A83B",
    alternativeColor: "#4D751C",
    theme: "interface",
    shortText:
      "Your Update Has Failed traces the digital evolution of efforts to change or suppress LGBTQIA+ identity. Across rooms shaped by 1997, 2003, 2016 and 2026, questionnaires become software, wellness platforms, moderation tools and AI classification. The language changes, but queer life persists through every attempted correction.",
    narrativeWords: ["update", "error", "restart", "persist"],
    creaturePart: {
      id: "signal-antenna",
      label: "Signal lure",
      description: "A glowing angler lure that keeps searching after failure.",
    },
  },
  {
    id: "grand-hotel-bald-cockatoo",
    exhibitionId: 5,
    targetIndex: 4,
    title: "The Grand Hotel Bald Cockatoo",
    artist: "Scott Rettberg, Caitlin Fisher, Roderick Coover",
    visualFamily: "machine",
    particleForm: "crest",
    color: "#D5A62E",
    alternativeColor: "#8A6500",
    theme: "worldmaking",
    shortText:
      "The Grand Hotel Bald Cockatoo is an immersive hotel of dreams managed by a fortune-telling cockatoo. Inside a nest-like installation, recombining dream fragments, generated images and separated voices surround visitors before an interactive device prints a fortune to take away.",
    narrativeWords: ["enter", "corridor", "wander", "transform"],
    creaturePart: {
      id: "cockatoo-beak",
      label: "Cockatoo beak",
      description: "A bright beak made for calling into strange hotels.",
    },
  },
  {
    id: "glass-like-fabric",
    exhibitionId: 6,
    targetIndex: 5,
    title: "Glass Like Fabric",
    artist: "Jason Nelson",
    visualFamily: "machine",
    particleForm: "prism",
    color: "#C4473D",
    alternativeColor: "#A52E27",
    theme: "interface",
    shortText:
      "Bybanen Slop Surfer is a playable descent into AI slop: Bergen flattened, exaggerated and reassembled through algorithmic culture. The familiar city is subjected to simplification, repetition, imitation and endless recombination until it becomes a cheerful synthetic approximation of itself.",
    narrativeWords: ["touch", "surface", "refract", "fold"],
    creaturePart: {
      id: "glass-wings",
      label: "Glass fins",
      description: "Translucent fins that fold light into new surfaces.",
    },
  },
  {
    id: "between-page-and-screen",
    exhibitionId: 7,
    targetIndex: 6,
    title: "Between Page and Screen",
    artist: "Amaranth Borsuk, Brad Bouse",
    visualFamily: "machine",
    particleForm: "book",
    color: "#ffffff",
    alternativeColor: "#000000",
    theme: "interface",
    shortText:
      "An unlikely marriage of print and digital, Between Page and Screen chronicles a love affair between two characters, P and S. The book has no words, only inscrutable black and white geometric patterns that, when coupled with a webcam, conjure the written word. Reflected on screen, the reader sees themself with open book in hand, language springing alive and shape-shifting with each turn of the page. The story unfolds through a playful and cryptic exchange of letters between P and S as they struggle to define their relationship. Rich with innuendo, anagrams, etymological and sonic affinities between words, Between Page and Screen revels in language and the act of reading.",
    narrativeWords: ["read", "letter", "decode", "respond"],
    creaturePart: {
      id: "page-fins",
      label: "Page fin",
      description:
        "A folded dorsal fin poised between print, screen and motion.",
    },
  },
  {
    id: "bybanen-slop-surfer",
    exhibitionId: 8,
    targetIndex: 7,
    title: "Bybanen Slop Surfer",
    artist: "Colin Richard Robinson",
    visualFamily: "body",
    particleForm: "skateboard",
    color: "#8B5E3C",
    alternativeColor: "#6B4027",
    theme: "embodiment",
    shortText: "Description forthcoming.",
    narrativeWords: ["move", "balance", "glide", "arrive"],
    creaturePart: {
      id: "surfer-feet",
      label: "Surfer fins",
      description: "Balanced pelvic fins ready to glide through the city.",
    },
  },
  {
    id: "emperor",
    exhibitionId: 9,
    targetIndex: 8,
    title: "Emperor",
    artist: "Marion Burger, Ilan Cohen",
    visualFamily: "body",
    particleForm: "brain",
    color: "#555555",
    alternativeColor: "#333333",
    theme: "embodiment",
    shortText:
      "Emperor is an interactive narrative experience that invites us to travel inside the brain of a father suffering from aphasia. Alongside his daughter, we journey into the father’s mental space, imagined as a hand-drawn monochrome landscape, as she seeks to learn more about his inner self, now obscured by illness.",
    narrativeWords: ["speak", "silence", "reach", "remember"],
    creaturePart: {
      id: "inner-eye",
      label: "Inner eye",
      description: "An extra eye for finding a way through an inner world.",
    },
  },
  {
    id: "grand-hotel-galactic-center",
    exhibitionId: 10,
    targetIndex: 9,
    title: "The Grand Hotel Galactic Center",
    artist: "Scott Robert Rettberg",
    visualFamily: "machine",
    particleForm: "galaxy",
    color: "#51477F",
    alternativeColor: "#40356D",
    theme: "worldmaking",
    shortText:
      "The Grand Hotel Galactic Center is a VR place of wonder and despair: looping clouds, flickering stars and glitzy exteriors conceal neglected infrastructure. Built with text-to-VR environments and gaussian splats, it turns the promise of spectacle into a repeated performance whose cracks gradually show.",
    narrativeWords: ["orbit", "signal", "navigate", "connect"],
    creaturePart: {
      id: "orbit-ring",
      label: "Orbit markings",
      description: "Luminous bands that keep distant worlds in conversation.",
    },
  },
  {
    id: "her-name-was-gisberta",
    exhibitionId: 11,
    targetIndex: 10,
    title: "Her Name Was Gisberta",
    artist: "Sérgio Galvão Roxo",
    visualFamily: "body",
    particleForm: "pillar",
    color: "#B44772",
    alternativeColor: "#8E2F57",
    theme: "agency",
    shortText:
      "Her Name Was Gisberta is a VR/2D documentary that portrays the life and death of Gisberta Salce, a Brazilian trans woman murdered by 14 young men in Porto in 2006. Drawing on virtual-reality perspective-taking, the project was created as a tool for education, social intervention and activism against transphobia.",
    narrativeWords: ["witness", "presence", "remember", "resist"],
    creaturePart: {
      id: "heart-plume",
      label: "Heart scale",
      description:
        "A bright central scale for presence, memory and resistance.",
    },
  },
  {
    id: "goliath",
    exhibitionId: 12,
    targetIndex: 11,
    title: "Goliath",
    artist: "Anagram",
    visualFamily: "machine",
    particleForm: "dodecahedron",
    color: "#2D7F88",
    alternativeColor: "#185F68",
    theme: "worldmaking",
    shortText:
      "Through mind-bending animation, Goliath: Playing with Reality explores the limits of reality and the true story of a man diagnosed with schizophrenia. Echo guides visitors through the realities of Goliath, who spent years isolated in psychiatric institutions before finding connection in multiplayer games. Heartfelt dialogue, mesmerising visuals and symbolic interactions reveal his story across multiple worlds.",
    narrativeWords: ["play", "world", "connect", "return"],
    creaturePart: {
      id: "goliath-horns",
      label: "Reality comb",
      description: "A dorsal comb tuned into more than one reality.",
    },
  },
  {
    id: "land-of-crystals",
    exhibitionId: 13,
    targetIndex: 12,
    title: "The Land of Crystals",
    artist: "The Land of Crystals",
    visualFamily: "memory",
    particleForm: "crystal",
    color: "#8CB6C7",
    alternativeColor: "#3D7288",
    theme: "memory",
    shortText:
      "The Land of Crystals reconstructs Edvard Munch’s demolished house and studios at Ekely from archival photographs and historical images. Munch’s writing is spoken by an intentionally speculative AI-generated voice, placing the film between historical absence, technological imagination and the parts of the past that cannot be recovered.",
    narrativeWords: ["archive", "crystal", "echo", "recover"],
    creaturePart: {
      id: "crystal-spines",
      label: "Crystal spines",
      description:
        "Faceted spines that refract fragments of places and voices that disappeared.",
    },
  },
  {
    id: "grand-hotel-sand-fountain",
    exhibitionId: 14,
    targetIndex: 13,
    title: "The Grand Hotel Sand Fountain",
    artist:
      "Scott Rettberg, Caitlin Fisher, Roderick Coover, Julian Pillis, Colin Robinson",
    visualFamily: "memory",
    particleForm: "hourglass",
    color: "#C19D65",
    alternativeColor: "#77572F",
    theme: "memory",
    shortText:
      "The Grand Hotel Sand Fountain is a collaborative AR work that extends the imaginary universes of Joseph Cornell and Robert Coover. Personal ephemera, generated imagery, human narration and synthetic speech form three entangled stories about memory, loss and haunted objects coming to life.",
    narrativeWords: ["sand", "revisit", "haunt", "recombine"],
    creaturePart: {
      id: "sand-hourglass",
      label: "Sand chamber",
      description:
        "A small hourglass chamber that lets memories fall into new arrangements.",
    },
  },
  {
    id: "fiery-sparks-of-light",
    exhibitionId: 15,
    targetIndex: 14,
    title: "Fiery Sparks of Light",
    artist: "Caitlin Fisher",
    visualFamily: "machine",
    particleForm: "spiral",
    color: "#E45D3E",
    alternativeColor: "#B43822",
    theme: "interface",
    shortText:
      "Fiery Sparks of Light is an AR experience presenting poems by Margaret Atwood, Nicole Brossard, Canisia Lubrin and Sarah Tolmie. QR codes in a printed book summon the poets as volumetric holograms while audiovisual effects amplify writing about patriarchy, objectification, stereotyping and oppression.",
    narrativeWords: ["ignite", "speak", "resist", "appear"],
    creaturePart: {
      id: "spark-plume",
      label: "Spark plume",
      description:
        "A luminous plume that turns spoken language into a visible trail.",
    },
  },
  {
    id: "fishbowl-leaks",
    exhibitionId: 16,
    targetIndex: 15,
    title: "The Fishbowl Leaks",
    artist: "Jakob Kusnick",
    visualFamily: "machine",
    particleForm: "fish",
    color: "#2F6FB5",
    alternativeColor: "#1D4F8A",
    theme: "worldmaking",
    shortText:
      "The Fishbowl Leaks turns the exhibition into a porous virtual aquarium. Through a browser-based AR layer, visitors meet fragments of the surrounding works as marine life and grow a personal creature from their path through the exhibition. On a shared screen the partitioned, classified tank slowly breaks down as creatures are added, until texts detach, species break free and the collective leaks into open water.",
    narrativeWords: ["contain", "leak", "gather", "evolve"],
    creaturePart: {
      id: "helping-arms",
      label: "Seeping bubbles",
      description: "Bubbles of the tank welling out through the skin, as if the creature itself is leaking the collective into open water.",
    },
  },
  {
    id: "realidad-mitigada",
    exhibitionId: 17,
    targetIndex: 16,
    title: "Realidad Mitigada",
    artist: "Tina Escaja",
    visualFamily: "body",
    particleForm: "crescent",
    color: "#9A6BDB",
    alternativeColor: "#5E2E9A",
    theme: "agency",
    shortText:
      "Realidad Mitigada (Mitigated Reality) is the AR app for Tina Escaja’s hybrid book of poems and digital artefacts. Works like Luna Morada (Black Moon) and Bar Codes address domestic violence and informatics control, turning the printing press and other technologies that once legitimised oppression into tools for subversion. Stickers at the end of the book carry its “Virus and the Sea” poems into the community, as readers place them in random locations around the world.",
    narrativeWords: ["scan", "mitigate", "testify", "spread"],
    creaturePart: {
      id: "barcode-fin",
      label: "Barcode fin",
      description:
        "A striped fin printed like a barcode, made to be peeled off and stuck somewhere new.",
    },
  },
];

export const artifacts: ExhibitionArtifact[] = exhibitionSources.map(
  ({ visualFamily, ...artifact }) => ({
    ...artifact,
    ...visualFamilies[visualFamily],
    ...aquariumLayers[artifact.id],
  }),
);

export const artifactById = new Map(
  artifacts.map((artifact) => [artifact.id, artifact]),
);

export const artifactByTargetIndex = new Map(
  artifacts.map((artifact) => [artifact.targetIndex, artifact]),
);

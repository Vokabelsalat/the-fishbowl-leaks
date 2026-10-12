import type { ConstellationSurface } from "@/components/particles/constellationPainter";
import type { ExhibitionArtifact } from "@/types/exhibition";

type ArtifactSource = Omit<
  ExhibitionArtifact,
  | "marineType"
  | "classification"
  | "visualTraits"
  | "stateEffects"
  | "storylet"
  | "choice"
>;

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
  "earth-fortunes": {
    marineType: "tarot-reading sea fan",
    classification: "Speculative climate oracle",
    visualTraits: ["tarot card fins", "pathway bands"],
    stateEffects: { agency: 2, openness: 1, coherence: -1 },
    storylet:
      "A deck of cards was dealt across the seabed. Each card showed the tank a different temperature.",
    choice: {
      prompt: "The cards foretell five futures for the tank.",
      options: [
        {
          id: "read",
          label: "Read the spread",
          effects: { coherence: 2, memory: 1 },
        },
        {
          id: "reshuffle",
          label: "Reshuffle the deck",
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
    artist: "Hilde K. Kjøs (Director & Story Design), Cecilie Levy (Scriptwriter & Original Idea), Bjørn-Morten Nerland (Producer)",
    particleForm: "torus",
    color: "#356B4B",
    alternativeColor: "#245137",
    theme: "memory",
    description:
      "In a “real unreality” VR space, a miniature Art Nouveau villa appears before expanding to full scale. Past and present weave together as we step into the world of Frida Hansen – once an internationally acclaimed textile artist, now largely forgotten. Guided by her great-great-granddaughter Cecilie, we explore a lush garden where archival photographs, a gramophone and woven artworks become portals into Frida’s life. As bankruptcy and profound personal grief descend, the vibrant garden withers into darkness. From this desolation emerge four enigmatic female figures, foreshadowing the work Semper Vadentes and the beginning of Frida’s artistic awakening. Across a century, Frida and Cecilie’s lives intertwine. Through art, hardship is transformed into enduring beauty – a testament to how the role models we uncover continue to inspire and shape who we become.",
    workType: ["Immersive Installation", "Immersive video"],
    year: 2026,
    platforms: ["Blender", "3ds Max", "Mistika", "DaVinci Resolve", "Photoshop", "RealityCapture", "Pro Tools"],
    links: [],
    contacts: [],
    bios: [
      "Hilde K. Kjøs is an award-winning filmmaker and photographer working across documentary, photography and immersive media. Her artistic practice explores place, memory and human presence. With a cinematic approach grounded in observation and visual subtext, Kjøs creates intimate encounters that invite audiences into complex human narratives. Her acclaimed documentaries Harvesting the Wasteland (Lykkens grøde) and Solace (Sju kammers) have screened internationally and won multiple awards. In September 2026, her VR debut Finding Frida premiered at the 83rd Venice International Film Festival, Venice Immersive.",
      "Cecilie Levy is an independent screenwriter and lecturer at the University of Amsterdam, Department of Media Studies. In 2023 she completed a PhD in Artistic Research at the Norwegian Film School with her project Light From Aside: A Screenwriter’s Perspective in Virtual Reality. Works include shorts, children’s series, films for television and feature films screened internationally, on television and at festivals. Levy has won several awards, incl. the Prix Jeunesse (Prix Europa), the Lucas Award and a nomination for an International Emmy® Kids Award. Part of the jury Digital Culture at the Dutch Film Festival in Utrecht, 2025.",
      "Bjørn-Morten Nerland is an XR producer and cinematographer based in Oslo, Norway, with more than 15 years of experience creating immersive experiences. He is the founder of RippleX Studios, an immersive production company specialising in virtual reality, spatial storytelling and interactive experiences. His work spans exhibitions, documentaries, commercial productions, music videos and immersive installations, combining cinematic storytelling with emerging technologies. He holds a Bachelor's degree in Media Technology from Lillehammer University College and has received multiple Gullruten (Norwegian Emmy) nominations, including for Innovation of the Year. His work has also been recognised as an Official Honoree at the Webby Awards for Best Use of Interactive Video, and he received the Best VR Film award at the VRINN Awards 2024.\n\nHis current work focuses on immersive documentary storytelling at the intersection of culture, heritage and emerging technologies.",
    ],
    image: { src: "/images/findingfrida Medium.jpeg", width: 640, height: 360 },
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
    artist: "Lina Ruth Harder",
    particleForm: "triad",
    color: "#6C3F61",
    alternativeColor: "#5A2F4F",
    theme: "memory",
    description:
      "Historically Yours is an interactive podcast broadcasting from the Underworld. This work in progress gives visitors a direct line to Cleo, Toinette and Henri, three fictional hosts loosely inspired by Cleopatra, Queen Marie Antoinette and astronomer Henrietta Swan Leavitt.\n\nIn the installation, visitors listen through headphones and send the hosts a question, a grievance or whatever is keeping them awake. Artificial intelligence transforms each contribution into a new conversation, performed through three synthetic voices. A live transcript accompanies the discussion, while illuminated sculptural heads reveal who has the microphone.\n\nThe hosts are not digital reconstructions of historical people. They are deliberately unreliable approximations assembled from historical fragments, popular myths and cultural stereotypes. Their appearances, both on screen and as 3D printed sculptures, reflect the familiar visual clichés through which historical women are recognised. Their voices are equally speculative. We do not know what these women sounded like, yet synthetic speech gives each host the persuasive impression of an individual personality.\n\nThe work draws on the Dialogues of the Dead, a satirical tradition in which historical figures meet in the afterlife to gossip, argue and judge the living. Here, it becomes a feminist podcast in which women who have been celebrated, blamed, romanticised or overlooked discuss the present from the Underworld.\n\nPart podcast, part séance and part critique of synthetic authority, Historically Yours asks who gets to represent the past and why a convincing face and voice can be so easy to believe.",
    workType: ["Interactive Installation", "Work in progress"],
    year: 2026,
    platforms: [],
    links: ["https://www.lina.berlin"],
    contacts: [],
    bios: [
      "Lina Ruth Harder is a PhD Fellow at the Center for Digital Narrative at the University of Bergen. Her practice based research explores generative AI, historical simulation and interactive narrative. Drawing on her background in museums and digital communication, she creates AI driven works about history, memory and encounters between humans and machines. She coined the term histobots for conversational agents that simulate people from the past. Through critical and playful experiments with emerging technologies, her work examines how historical personalities are constructed, whose stories are remembered and how artificial intelligence reshapes our relationship with the past.",
    ],
    image: { src: "/images/Historically Yours_Podcast Cover Medium.jpeg", width: 640, height: 640 },
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
    particleForm: "tree",
    color: "#597D8C",
    alternativeColor: "#365E6D",
    theme: "memory",
    description:
      "Technology is reshaping our relationships and communication with the dead, using digital traces of the data they leave behind. Decades before these technologies emerged, I was already doing something similar.\n\nFrom Ingrid to Bergen is an interactive documentary about grief, memory, theatre, and the technologies we use to maintain relationships with what is no longer there. Moving across nineteen years, the project brings together personal archives, photographs, paintings, videos, and texts from different phases of my experience of loss. An idea of a grandmother, a promise, ghosts, forests, neurodivergence, theatre, and Ingrid Bergman form a shifting map through memory and reconstruction, tracing not only the loss of a person, but also the loss of what I once imagined becoming.",
    workType: ["Interactive Documentary"],
    year: 2026,
    platforms: [],
    links: ["https://pedro-velho.com/"],
    contacts: ["Pedro.Pinto@uib.no"],
    bios: [
      "Pedro Queirós Pinto, artistically known as Pedro Velho, is a researcher, mediator, educator, and creative based in Bergen, Norway. He is currently a Research Assistant in the Extending Digital Narrative (XDN) group at the Center for Digital Narrative (CDN), University of Bergen, where he focuses on digital narratives and creative practices.\n\nHis work spans mediation, narrative, non-fiction, and performance, drawing on intermedial and socially engaged approaches to explore how creative practice shapes the conditions for meaningful encounters among people, stories, and communities.",
    ],
    image: { src: "/images/fromingridtobergen Medium.jpeg", width: 453, height: 640 },
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
    particleForm: "cuboid",
    color: "#79A83B",
    alternativeColor: "#4D751C",
    theme: "interface",
    description:
      "YOUR UPDATE HAS FAILED is an interactive browser and WebXR experience tracing the digital evolution of SOGICE—sexual orientation and gender identity change efforts. These interventions seek to change or suppress LGBTQIA+ people’s sexual orientation, gender identity, or expression.\n\nA computer anchors the narrative as three composite lives unfold across 1997, 2003, 2016, and 2026—each in a room shaped by its era. SOGICE’s forms evolve: printed questionnaires become software, then wellness platforms, moderation tools, and, eventually, AI-driven systems that classify and collect data. Blending documented practices with imagined scenes, the work reveals SOGICE not as a single event, but as a digital ecosystem spanning “ex-gay” testimonies, promotional videos, exercises, prayers, and data systems. Language shifts toward care and progress, but the underlying pressure to conform remains.\n\nWith each update, the system appears new; with each restart, it enters another era; and with every glitch, its limits are exposed. Visitors navigate the story through a headset, desktop, or phone—clicking, reading, and turning to explore the changing rooms. A dossier accompanies the work, linking sources with the narrative. Through its many transformations, SOGICE’s apparatus adapts and renews its promise of correction, but its failure endures: queer life persists.",
    workType: ["WebXR", "Interactive Browser", "Work in progress"],
    year: 2026,
    platforms: [],
    links: ["https://sergiogalvaoroxo.com/"],
    contacts: ["sergio.roxo@uib.no"],
    bios: [
      "Sérgio Galvão Roxo (1990, Portugal) is an artist, researcher, and LGBTQIA+ social intervention specialist. He is currently a PhD Research Fellow at the University of Bergen, exploring audiovisual storytelling and immersive media as tools for awareness, belonging, activism, and education.\n\nHis work Her Name Was Gisberta (2023), an immersive documentary, has been showcased at international festivals, including SXSW, DOK Leipzig, and Ji.hlava IDFF. The project received the AIXR Inclusivity XR Grant (2024) and was nominated for the AIXR Social Impact Award (2024). It also won the National Grand Prix at FEST — New Directors | New Films Festival (2024).",
    ],
    image: { src: "/images/yourupdatehasfailed Medium.jpeg", width: 640, height: 360 },
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
    artist: "Roderick Coover, Caitlin Fisher, Scott Rettberg",
    particleForm: "crest",
    color: "#D5A62E",
    alternativeColor: "#8A6500",
    theme: "worldmaking",
    description:
      "The Grand Hotel Bald Cockatoo is an immersive installation, the second work in the Visitations: The Grand Hotels (of Joseph Cornell) series. Based on perhaps the most absurd of Robert Coover’s sketches from his book The Grand Hotels (of Joseph Cornell), this hotel is a hotel of dreams, in which the hotel manager is a fortunetelling cockatoo. The audience enters a large installation in the form of a bird’s nest. Embedded in the walls of the nest are four large screens, where short dream narratives recombine. The authors wrote the dream narratives in an adapted exquisite-corpse fashion, using AI text-to-video generation as a prompt. Voices based on modernist authors, tracked separately from the videos, narrate the stories. At the back of the nest is the fortune-teller and an interactive fortune-telling device. Guests can press a button to generate a fortune of their own, which is printed for them to take home.",
    workType: ["Immersive Installation"],
    year: 2026,
    platforms: ["Runway", "Seedance 2.0", "Lumina Dream Machine", "Adobe Premiere", "Adobe Audition", "ChatGPT Image", "Adobe Firefly", "Claude (coding)", "ElevenLabs", "Python", "Carpentry"],
    technicalDetails: "Installation with five channel video and two channel audio",
    links: ["https://retts.net/grandhotels/"],
    contacts: ["Scott.Rettberg@uib.no"],
    bios: [
      "Roderick Coover is a filmmaker, digital artist, and professor of Film and Media Arts at Temple University in Philadelphia. A pioneer of interactive cinema and immersive storytelling, he combines documentary research, experimental film, and digital technologies to explore environmental change, cultural experience, and the possibilities of narrative. His works include Unknown Territories, Toxi•City: A Climate Change Narrative, and the collaborative virtual reality installation Hearts and Minds: The Interrogations Project. His projects have been exhibited internationally, including at the Venice Biennale, SIGGRAPH, and the Bibliothèque nationale de France. He edited The Digital Imaginary: Literature and Cinema of the Database and coedited Switching Codes. Coover holds a doctorate from the University of Chicago and received Fulbright, Mellon, and Whiting fellowships and awards. He is collaborating with Caitlin Fisher and Scott Rettberg on the Visitations: The Grand Hotels (of Joseph Cornell) series of immersive narratives.",
      "Caitlin Fisher is an award-winning digital storyteller and poet, working mostly in XR. She directs the art+science Immersive Storytelling Lab and the Augmented Reality Lab at York University in Toronto. At York she is also Chair and a Full Professor in the Department of Film and Media Arts. A co-founder of York’s Future Cinema Lab and former Fulbright and Canada Research Chair, Caitlin has funded research projects in the areas of AI storytelling, co-creation between settler and indigenous artists in VR environments and is bringing the power of storytelling to the global health crisis of antimicrobial resistance through a new XR Museum project. She is immediate past President of the Electronic Literature Organization and is also a Prof. II at the University of Bergen, working with the Centre for Digital Narrative.",
      "Scott Rettberg is director of the Center for Digital Narrative (CDN), a Norwegian Centre of Research Excellence, and professor of digital culture at the University of Bergen. A writer, artist, and scholar, he explores how computational technologies transform storytelling, authorship, and creative practice. He cofounded the Electronic Literature Organization and served as its first executive director. His book Electronic Literature received the 2019 N. Katherine Hayles Award for Criticism of Electronic Literature. His collaborative works include The Unknown, Implementation, and Hearts and Minds: The Interrogations Project, winner of the 2016 Robert Coover Award. Rettberg leads the Extending Digital Narrative project, investigating emerging narrative forms through artistic experimentation with artificial intelligence, games, and extended reality. He is collaborating with Roderick Coover and Caitlin Fisher on the Visitations: The Grand Hotels (of Joseph Cornell) series of immersive narratives.",
    ],
    image: { src: "/images/grandhotel Medium.jpeg", width: 640, height: 358 },
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
    title: "Glasslike Fabric",
    artist: "Jason Nelson",
    particleForm: "prism",
    color: "#C4473D",
    alternativeColor: "#A52E27",
    theme: "interface",
    description:
      "Glasslike Fabric is an interactive narrative where the reader scans the world, anything, everywhere, and generates strange stories about things capture by their phone’s camera. The viewer points at a room, street, object or landscape and presses Scan. The work captures a still image, finds shapes within it and outlines selected regions. Red and grey lines, arrows, labels and fragments of equations connect the shapes.\n\nThe work uses OpenCV.js to detect edges and colour boundaries, identify contours and select prominent shapes. Tapping an outlined shape opens a short fictional incident report, assembled from prewritten phrases using a far too complex generative story engine. The shape’s type determines which opening phrases are available, while its size and complexity also affect the brief stories.\n\nThese are generated stories of places where neighbouring dimensions overlapped, allowing materials and objects to intermingle and impact their respective worlds. Trajectories change direction, glass retains an image, a wall becomes fabric.\n\nWith a near infinite number of stories, the work builds new worlds with every new snapshot of what’s around you, ordinary surroundings become imagined incidents, diagrams measure the evidential rate.",
    workType: ["Augmented Reality", "Interactive Digital Literature"],
    year: 2026,
    platforms: ["OpenCV.js"],
    links: ["https://dpoetry.com"],
    contacts: ["Jason.nelson@uib.no"],
    bios: [
      "Jason Nelson is a digital poet and artist, combining poetry, narrative, images, sound, movement and interaction in digital writing and games. He grew up in Oklahoma City and became a digital writer in Australia. He Professes all sorts of magic things at the University of Bergen and is a principal investigator in the Center for Digital Narrative. His works have won 14 awards and prizes, including a Webby, Queensland Premier’s Literary prize, and the ELO Maverick Award among others.",
    ],
    image: { src: "/images/Glasslike-catalog-image-300 Medium.jpeg", width: 640, height: 453 },
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
    particleForm: "book",
    color: "#ffffff",
    alternativeColor: "#000000",
    theme: "interface",
    description:
      "An unlikely marriage of print and digital, Between Page and Screen chronicles a love affair between two characters, P and S.\n\nThe book has no words, only inscrutable black and white geometric patterns that, when coupled with a webcam, conjure the written word. Reflected on screen, the reader sees him or herself with open book in hand, language springing alive and shape-shifting with each turn of the page.\n\nThe story unfolds through a playful and cryptic exchange of letters between P and S as they struggle to define their relationship. Rich with innuendo, anagrams, etymological and sonic affinities between words, Between Page and Screen revels in language and the act of reading.",
    workType: ["Augmented Reality", "Interactive Digital Literature"],
    year: 2009,
    platforms: [],
    links: ["https://www.betweenpageandscreen.com"],
    contacts: ["hello@betweenpageandscreen.com"],
    bios: [
      "Amaranth Borsuk is the author of Pomegranate Eater (Kore Press, 2016), a collection of poems; As We Know (Subito, 2014), a book-length erasure collaboration with Andy Fitch; Handiwork (Slope Editions, 2012), selected by Paul Hoover for the 2011 Slope Editions Book Prize; and Tonal Saw (The Song Cave, 2010), a chapbook. Abra (1913 Press, 2016), a book of mutating poems created with Kate Durbin, received an NEA-sponsored Expanded Artists’ Books grant from the Center for Book and Paper Arts at Columbia College Chicago and was recently released as a limited-edition book with a free iPad / iPhone app created by Ian Hatcher. Borsuk's other digital collaborations include The Deletionist, an erasure bookmarklet created with Nick Montfort and Jesper Juul; and Whispering Galleries, a site-specific LeapMotion interactive textwork for the New Haven Free Public Library. Borsuk received her Ph.D. in Literature and Creative Writing at the University of Southern California and served as a Mellon Postdoctoral Fellow in the Humanities at MIT before joining the faculty of the University of Washington, Bothell, where she is currently an Assistant Professor in the School of Interdisciplinary Arts and Sciences.",
      "Brad Bouse is a developer whose work focuses on the intersection of art and technology. He is the co-founder of Lightboard. He frequently presents about art and code, including this presentation about the Usefulness of Uselessness at JSConf.EU in Berlin.",
    ],
    image: { src: "/images/frompage Medium.jpeg", width: 640, height: 360 },
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
    artist: "Colin Robinson",
    particleForm: "skateboard",
    color: "#8B5E3C",
    alternativeColor: "#6B4027",
    theme: "embodiment",
    description:
      "Bybanen Slop Surfer is a playable descent into AI slop: a version of Bergen flattened, exaggerated and reassembled through the visual language of algorithmically generated culture.\n\nThe work takes a recognizable city and subjects it to the same processes increasingly applied to images, writing, music and online culture: simplification, repetition, imitation and endless recombination.\n\nBergen becomes simultaneously familiar and synthetic — a cheerful approximation of itself.",
    workType: ["VR Game", "VR Installation"],
    year: 2026,
    platforms: [],
    links: [],
    contacts: [],
    bios: [
      "Colin Robinson is a technical artist and engineer interested in experimental forms of interaction and play. His works span 3D art, game design, electronics, fabrication, and software, with a particular interest in challenging established design conventions, finding questionable uses for new technologies, and making people smile.",
    ],
    image: { src: "/images/bybannen Medium.jpeg", width: 640, height: 640 },
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
    particleForm: "brain",
    color: "#555555",
    alternativeColor: "#333333",
    theme: "embodiment",
    description:
      "Emperor, an interactive and narrative experience which invites us to travel inside the brain of a father, suffering from aphasia. Alongside his daughter, we journey into the father’s mental space – imagined as a hand-drawn, monochrome landscape – as she seeks to learn more about his inner self, now obscured by illness.",
    workType: ["VR"],
    year: 2023,
    platforms: [],
    links: [],
    contacts: [],
    bios: [
      "Marion Burger is a French filmmaker and production designer whose work spans cinema and immersive storytelling. She has worked as a production designer on films including Divines (2016), Gagarine (2020), and Mother and Son (2022). Her directorial debut, EMPEROR (2023), co-created with Ilan J. Cohen, is an interactive virtual reality experience inspired by her father's experience of aphasia. Combining monochromatic, hand-drawn landscapes with poetic and surrealist storytelling, the work explores language, memory, communication, and the emotional bonds between family members.",
      "Ilan J. Cohen is a French filmmaker, screenwriter, and director whose practice encompasses cinema, music videos, and immersive storytelling. Since 2008, he has worked as a first assistant director on film productions while developing his own writing and directing projects, including music videos for musicians such as Rone and Gaspar Claus. Together with Marion Burger, he co-wrote and co-directed EMPEROR (2023), an interactive virtual reality experience that explores aphasia through the inner world of a father who has lost the ability to speak. The project combines immersive narrative, animation, and poetic visual design to investigate language, memory, and human connection.",
    ],
    image: { src: "/images/EMPEREUR_Still_001-Amandine-Gabard-scaled Medium.jpeg", width: 640, height: 457 },
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
    artist: "Scott Rettberg, Caitlin Fisher, Roderick Coover, Colin Robinson (VR development)",
    particleForm: "galaxy",
    color: "#51477F",
    alternativeColor: "#40356D",
    theme: "worldmaking",
    description:
      "The third work in the Visitations: The Grand Hotels (of Joseph Cornell) series, the headset VR experience The Grand Hotel Galactic Center is perhaps the grandest of the grand hotels–at a glance–but after several days in the bubble you realize why the rooms come so cheap. It is a hotel of both wonder and despair. The clouds are on an infinite loop. The stars are all flickering. Glitzy exteriors concealing broken-down infrastructure Like a boarding house that is maintained without care. The exotic floor show almost makes up for it. But you sense that it is the same every night, and the performers are just going through the motions. You wish you could see something beyond the banality, but it just isn’t there. You might have loved this when you were a child, but every ounce of your childhood is gone, sapped from you. This is the kind of palliative care you get with the basic insurance. Galactic Center explores text-to-VR environment generation and gaussian splats as components of a Unity development process. Trigger warning: includes a reference to suicide.",
    workType: ["VR", "Work in progress"],
    year: 2026,
    platforms: ["Unity", "Marble", "ChatGPT Image", "Adobe Photoshop", "Claude (Code)"],
    links: ["https://retts.net/grandhotels/"],
    contacts: ["Scott.Rettberg@uib.no"],
    bios: [
      "Roderick Coover is a filmmaker, digital artist, and professor of Film and Media Arts at Temple University in Philadelphia. A pioneer of interactive cinema and immersive storytelling, he combines documentary research, experimental film, and digital technologies to explore environmental change, cultural experience, and the possibilities of narrative. His works include Unknown Territories, Toxi•City: A Climate Change Narrative, and the collaborative virtual reality installation Hearts and Minds: The Interrogations Project. His projects have been exhibited internationally, including at the Venice Biennale, SIGGRAPH, and the Bibliothèque nationale de France. He edited The Digital Imaginary: Literature and Cinema of the Database and coedited Switching Codes. Coover holds a doctorate from the University of Chicago and received Fulbright, Mellon, and Whiting fellowships and awards. He is collaborating with Caitlin Fisher and Scott Rettberg on the Visitations: The Grand Hotels (of Joseph Cornell) series of immersive narratives.",
      "Caitlin Fisher is an award-winning digital storyteller and poet, working mostly in XR. She directs the art+science Immersive Storytelling Lab and the Augmented Reality Lab at York University in Toronto. At York she is also Chair and a Full Professor in the Department of Film and Media Arts. A co-founder of York’s Future Cinema Lab and former Fulbright and Canada Research Chair, Caitlin has funded research projects in the areas of AI storytelling, co-creation between settler and indigenous artists in VR environments and is bringing the power of storytelling to the global health crisis of antimicrobial resistance through a new XR Museum project. She is immediate past President of the Electronic Literature Organization and is also a Prof. II at the University of Bergen, working with the Centre for Digital Narrative.",
      "Scott Rettberg is director of the Center for Digital Narrative (CDN), a Norwegian Centre of Research Excellence, and professor of digital culture at the University of Bergen. A writer, artist, and scholar, he explores how computational technologies transform storytelling, authorship, and creative practice. He cofounded the Electronic Literature Organization and served as its first executive director. His book Electronic Literature received the 2019 N. Katherine Hayles Award for Criticism of Electronic Literature. His collaborative works include The Unknown, Implementation, and Hearts and Minds: The Interrogations Project, winner of the 2016 Robert Coover Award. Rettberg leads the Extending Digital Narrative project, investigating emerging narrative forms through artistic experimentation with artificial intelligence, games, and extended reality. He is collaborating with Roderick Coover and Caitlin Fisher on the Visitations: The Grand Hotels (of Joseph Cornell) series of immersive narratives.",
    ],
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
    particleForm: "pillar",
    color: "#B44772",
    alternativeColor: "#8E2F57",
    theme: "agency",
    description:
      "Her Name Was Gisberta is a VR/2D documentary that portrays the life and death of Gisberta Salce, a Brazilian Trans woman murdered by 14 young men (12 - 16 years old) in the city of Porto (Portugal) in 2006. Uniting the knowledge provided by Virtual Reality Perspective-Taking Tasks, this project was created as a tool of education, social intervention and activism against transphobia.",
    workType: ["VR"],
    year: 2023,
    platforms: [],
    links: [],
    contacts: [],
    bios: [],
    narrativeWords: ["witness", "presence", "remember", "resist"],
    creaturePart: {
      id: "heart-plume",
      label: "Sea anemone",
      description:
        "A low anemone holding close to the skin: a living shelter for presence and memory that stings back.",
    },
  },
  {
    id: "goliath",
    exhibitionId: 12,
    targetIndex: 11,
    title: "Goliath",
    artist: "ANAGRAM",
    particleForm: "dodecahedron",
    color: "#2D7F88",
    alternativeColor: "#185F68",
    theme: "worldmaking",
    description:
      "Through mind-bending animation, GOLIATH: PLAYING WITH REALITY explores the limits of reality and a true story of so-called ‘schizophrenia’ and the power of gaming communities. Echo (Tilda Swinton) guides you through the many realities of Goliath, a man who spent years isolated in psychiatric institutions but finds connection in multiplayer games. Combining heartfelt dialogue, mesmerising visuals and symbolic interactions, weave through multiple worlds to uncover Goliath’s poignant story.",
    workType: ["VR"],
    year: 2022,
    platforms: [],
    links: [],
    contacts: [],
    bios: [
      "ANAGRAM is an award-winning creative studio specialising in interactive storytelling and immersive experiences. Working at the intersection of documentary, technology, and artistic experimentation, the studio creates thought-provoking works that explore human experiences and social issues through innovative forms of audience engagement. Its productions include Goliath: Playing with Reality (2021/2022), an animated virtual reality experience exploring schizophrenia, gaming, and human connection. Directed by Barry Gene Murphy and May Abdalla, narrated by Tilda Swinton, and co-produced with Floréal Films, the project won the Grand Jury Prize for Best VR Work at the 2021 Venice International Film Festival and received numerous international awards and nominations, including an Emmy nomination.",
    ],
    image: { src: "/images/Goliath Medium.jpeg", width: 640, height: 360 },
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
    artist: "Eamon O'Kane",
    particleForm: "crystal",
    color: "#8CB6C7",
    alternativeColor: "#3D7288",
    theme: "memory",
    description:
      "The Land of Crystals creates a moving panorama from archival photographs and historical images of Edvard Munch’s demolished house and studios at Ekely in Oslo. Through the manipulation and sequencing of these still images, the film reconstructs a place that no longer exists, creating a virtual passage through Munch’s working environment and the landscape that surrounded it.\n\nThe film’s voice-over is drawn from Munch’s writings in The Tree of Knowledge of Good and Evil, a portfolio of texts and images compiled at Ekely in 1915–16. Several of the archival photographs show Munch in his Winter Studio, creating a direct connection between the written voice heard in the film and the physical spaces in which these texts were conceived.\n\nThe Norwegian texts are spoken by an AI-generated voice. This introduces an intentional tension between historical memory and contemporary technology. Munch recorded his voice onto wax cylinders during his lifetime, but none of these recordings have survived, and there is no known surviving recording that allows us to hear what his voice sounded like. The voice in The Land of Crystals is therefore neither an attempt to reproduce Munch’s actual voice nor a historical reconstruction. Instead, it occupies the space between absence and imagination: a technologically generated voice giving sound to words whose author’s own voice has been irretrievably lost.\n\nThe title is taken from Munch’s writings, in which he refers to a “Land of Crystals.” For O’Kane, the phrase becomes both a poetic image and a conceptual framework for thinking about memory, geological time, transformation, and the archive. The film considers how technology can reactivate fragments of the past while simultaneously reminding us of what can never be recovered.",
    workType: ["Video"],
    year: 2026,
    platforms: [],
    links: ["https://www.eamonokane.com"],
    contacts: ["eamon.okane@uib.no"],
    bios: [
      "Eamon O’Kane (b. 1974, Belfast) is an Irish artist and Professor of Visual Art at the University of Bergen, Norway. Working across painting, drawing, photography, sculpture, installation and AI-generated imagery, his practice explores the relationships between memory, architecture, ecology and changing technologies. His work frequently takes modernist architecture, domestic spaces, artist studios and landscapes as sites through which histories and temporalities can be examined.\n\nO’Kane’s long-term projects include Greenhouse Archive, a decade-long documentation and artistic investigation of a former plant nursery in Denmark, and The School of Generational Storytelling, developed through collaborations with care homes and communities in Ireland. His research also encompasses climate narratives, posthumanism, and the role of AI within contemporary artistic practice. He has exhibited internationally through solo and group exhibitions, publications, and research projects. O’Kane is a member of the leader group of the Centre for Digital Narrative at the University of Bergen.",
    ],
    image: { src: "/images/munch-in-his-winter-studio-in-ekely-on-his-seventy-fifth-birthday-1938-photogrpahy-by-ragnvald-vaering- Medium.jpeg", width: 472, height: 640 },
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
    artist: "Scott Rettberg, Caitlin Fisher, Roderick Coover, Julian Pillis (Additional development), Colin Robinson (Additional development)",
    particleForm: "hourglass",
    color: "#C19D65",
    alternativeColor: "#77572F",
    theme: "memory",
    description:
      "The first of the Visitations: The Grand Hotels of Joseph Cornell series, Sand Fountain is a collaborative AR project that extends one of the imaginary universes of Joseph Cornell's collage shadowbox hotel series and the Robert Coover’s book of short fictions The Grand Hotels (of Joseph Cornell). The Grand Hotel Sand Fountain is a place of memory and loss. The work takes a kaleidoscopic approach to time, image, and language through the creation of evocative and entangled narratives interweaving past texts and imagined actions. Visitors walk three poetic narratives were individually written and collaboratively crafted. The visuals range from deeply personal ephemera to AI-generated images. The narration plays between human voice and generated speech. Haunted objects come to life through collaborative writing methods, assembling fleeting stories, experimenting with generative AI platforms in the AR production workflow, resulting new storytelling methods.",
    workType: ["Augmented Reality"],
    year: 2025,
    platforms: ["Adobe Aero", "Unity", "DALL•E 3", "Adobe Photoshop", "ElevenLabs"],
    technicalDetails: "AR experience for Android tablets",
    links: ["https://retts.net/grandhotels/"],
    contacts: ["Scott.Rettberg@uib.no"],
    bios: [
      "Roderick Coover is a filmmaker, digital artist, and professor of Film and Media Arts at Temple University in Philadelphia. A pioneer of interactive cinema and immersive storytelling, he combines documentary research, experimental film, and digital technologies to explore environmental change, cultural experience, and the possibilities of narrative. His works include Unknown Territories, Toxi•City: A Climate Change Narrative, and the collaborative virtual reality installation Hearts and Minds: The Interrogations Project. His projects have been exhibited internationally, including at the Venice Biennale, SIGGRAPH, and the Bibliothèque nationale de France. He edited The Digital Imaginary: Literature and Cinema of the Database and coedited Switching Codes. Coover holds a doctorate from the University of Chicago and received Fulbright, Mellon, and Whiting fellowships and awards. He is collaborating with Caitlin Fisher and Scott Rettberg on the Visitations: The Grand Hotels (of Joseph Cornell) series of immersive narratives.",
      "Caitlin Fisher is an award-winning digital storyteller and poet, working mostly in XR. She directs the art+science Immersive Storytelling Lab and the Augmented Reality Lab at York University in Toronto. At York she is also Chair and a Full Professor in the Department of Film and Media Arts. A co-founder of York’s Future Cinema Lab and former Fulbright and Canada Research Chair, Caitlin has funded research projects in the areas of AI storytelling, co-creation between settler and indigenous artists in VR environments and is bringing the power of storytelling to the global health crisis of antimicrobial resistance through a new XR Museum project. She is immediate past President of the Electronic Literature Organization and is also a Prof. II at the University of Bergen, working with the Centre for Digital Narrative.",
      "Scott Rettberg is director of the Center for Digital Narrative (CDN), a Norwegian Centre of Research Excellence, and professor of digital culture at the University of Bergen. A writer, artist, and scholar, he explores how computational technologies transform storytelling, authorship, and creative practice. He cofounded the Electronic Literature Organization and served as its first executive director. His book Electronic Literature received the 2019 N. Katherine Hayles Award for Criticism of Electronic Literature. His collaborative works include The Unknown, Implementation, and Hearts and Minds: The Interrogations Project, winner of the 2016 Robert Coover Award. Rettberg leads the Extending Digital Narrative project, investigating emerging narrative forms through artistic experimentation with artificial intelligence, games, and extended reality. He is collaborating with Roderick Coover and Caitlin Fisher on the Visitations: The Grand Hotels (of Joseph Cornell) series of immersive narratives.",
    ],
    image: { src: "/images/Screenshot_2025-11-21_11-40-20 Medium.jpeg", width: 640, height: 425 },
    narrativeWords: ["sand", "revisit", "haunt", "recombine"],
    creaturePart: {
      id: "sand-hourglass",
      label: "Barnacles",
      description:
        "Sand-coloured barnacles grown over the skin, small chambers that close over the memories they keep.",
    },
  },
  {
    id: "fiery-sparks-of-light",
    exhibitionId: 15,
    targetIndex: 14,
    title: "Fiery Sparks of Light",
    artist: "Caitlin Fisher",
    particleForm: "spiral",
    color: "#E45D3E",
    alternativeColor: "#B43822",
    theme: "interface",
    description:
      "Fiery Sparks of Light is an AR experience that reimagines a collection of poems by four renowned Canadian women poets - Margaret Atwood, Nicole Brossard, Canisia Lubrin and Sarah Tolmie. It was launched as part of an exclusive hybrid (onsite/digital) programme in Germany that celebrates Canada as the Frankfurt Book Fair Guest of Honor 2021.\n\nUsing volumetric cinema technology as the foundation, Fiery Sparks of Light includes an accompanying printed book that contains QR codes that bring  Atwood, Brossard, Lubrin and Tolmie to life as holograms on a mobile device. This enabled Book Fair guests to experience these four poets reading their own original poems, which explore feminist perspectives of patriarchy, gendered objectification, stereotyping and oppression, while further augmented audiovisual after-effects enhance the viewer’s experience. This sensory exploration is designed to elicit an emotional response as users set the stage for these fiery written words to spark to life.",
    workType: ["Augmented Reality"],
    year: 2021,
    platforms: [],
    links: [],
    contacts: [],
    bios: [
      "Caitlin Fisher is an award-winning digital storyteller and poet, working mostly in XR. She directs the art+science Immersive Storytelling Lab and the Augmented Reality Lab at York University in Toronto. At York she is also Chair and a Full Professor in the Department of Film and Media Arts. A co-founder of York’s Future Cinema Lab and former Fulbright and Canada Research Chair, Caitlin has funded research projects in the areas of AI storytelling, co-creation between settler and indigenous artists in VR environments and is bringing the power of storytelling to the global health crisis of antimicrobial resistance through a new XR Museum project. She is immediate past President of the Electronic Literature Organization and is also a Prof. II at the University of Bergen, working with the Centre for Digital Narrative.",
    ],
    image: { src: "/images/Fiery Medium.jpeg", width: 640, height: 357 },
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
    particleForm: "fish",
    color: "#2F6FB5",
    alternativeColor: "#1D4F8A",
    theme: "worldmaking",
    description:
      "The Fishbowl Leaks transform(s) the exhibition into a porous virtual aquarium…\nVisitors encounter fragments of the surrounding works as marine life and unstable species through a browser-based augmented reality layer. Each encounter alters a personal creature, shaped by the visitor’s movement through the exhibition, transforming it into a generative story.\n\nThe aquarium acts as both environment and metaphor. It displays containment but also resembles a collective, developing system. On a shared screen, the aquarium begins in a state of order: partitioned and classified. As visitors contribute their creatures, this order gradually breaks down. Texts detach, species break free, the tank falls apart, and memory is leaking, releasing the creatures into open waters…\n\nThe Fishbowl Leaks imagine(s) a living narrative ecosystem. The single artworks start in fixed \ncategories and grow together into a symbiotic, participatory collective, by the help of exhibition \nvisitors. The result sits between exhibition guide, generative story system, and shared \nhallucination in a container. What might evolve when that container starts to leak?",
    workType: ["Augmented Reality", "Work in Progress"],
    year: 2026,
    platforms: [],
    links: ["https://kusnick.com"],
    contacts: ["jakob@kusnick.com"],
    bios: [
      "Jakob Kusnick is a LEAD AI postdoctoral fellow at the Center for Digital Narrative in the Department of Linguistic, Literary and Aesthetic Studies at the University of Bergen. He leads Narrative Nubs, a project in collaboration with Nick Montfort at MIT that explores AI story generators and develops miniature versions of them as a platform for research, teaching, and artistic practice. His research investigates how interactive visualizations can make these complex systems understandable and usable, for example, through glyph-based summaries for comparing AI story systems and interfaces for tracing generation processes and analyzing large collections of outputs. Jakob received his PhD in Computer Science in 2024 from the University of Southern Denmark in Odense, where his dissertation focused on visualization-based storytelling for digital humanities. He then continued there as a postdoctoral researcher, with work spanning tangible and intangible cultural heritage, musicology, history, sustainability, and the life sciences.",
    ],
    image: { src: "/images/fishbowl-leaks-poster Medium.jpeg", width: 426, height: 640 },
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
    particleForm: "crescent",
    color: "#9A6BDB",
    alternativeColor: "#5E2E9A",
    theme: "agency",
    description:
      "Realidad Mitigada (Mitigated Reality) is an AR/Extended Reality App created for the project and hybrid book Realidad Mitigada, a book that collects poems and digital “artefacts” by Tina Escaja (aka Alm@ Pérez). Many of Escaja’s poems and digital works reflects upon issues of social justice, such as domestic violence (Luna Morada/Black Moon) and informatics control (Bar Codes), which makes this book particularly relevant given its potential subversion of traditional technologies that have served to legitimate oppression, such as the printing press. Realidad mitigada / Mitigated Reality is an innovative work created by four professionals in the digital arts. The AR app for the project allows the reader to have an “extended reality” experience that will provide a unique and groundbreaking involvement. The series of stickers located at the end of the book expands the “Virus and the Sea” segment of the book to the community by inviting the reader to place them in random locations, in the way that the QR codes for Escaja’s COVID-19 project have already been posted in cities around the world to collect testimonies about our experiences during the pandemic.",
    workType: ["Augmented Reality", "Interactive Digital Literature"],
    year: 2022,
    platforms: [],
    links: ["https://www.tinaescaja.com"],
    contacts: ["tina.escaja@uvm.edu"],
    bios: [
      "Tina Escaja (also known as Alm@ Pérez) is a Spanish-American poet, writer, feminist scholar, and digital artist. She is a Distinguished Professor of Spanish and Gender Studies at the University of Vermont, where her research explores gender, technology, and contemporary Spanish and Latin American literature. Considered a pioneer of electronic literature in Spanish, her interdisciplinary practice combines poetry, digital media, robotics, augmented reality, and multimedia installations to challenge conventional literary forms and explore the intersections of technology, identity, and social justice. Her digital works have been exhibited internationally in museums and galleries. Her literary awards include the Dulce María Loynaz International Poetry Prize for Caída libre (2004) and the Campoy-Ada Prize for young adult poetry (2017).",
    ],
    image: { src: "/images/realidadmitigada Medium.jpeg", width: 640, height: 452 },
    narrativeWords: ["scan", "mitigate", "testify", "spread"],
    creaturePart: {
      id: "barcode-fin",
      label: "Barcode fin",
      description:
        "A striped fin printed like a barcode, made to be peeled off and stuck somewhere new.",
    },
  },
  {
    id: "earth-fortunes",
    exhibitionId: 18,
    targetIndex: 17,
    title: "Earth Fortunes",
    artist: "Caitlin Fisher",
    particleForm: "butterfly",
    color: "#C77B30",
    alternativeColor: "#94531A",
    theme: "worldmaking",
    description:
      "Earth Fortunes is conceived of as an exploratory journey through some of the ways energy systems affect our lives. If you are excited, worried, or unsure about future energy systems, Earth Fortunes allows you to ‘foretell’ the planet’s future using tarot cards outfitted with augmented reality (AR) visualization informed by the climate science and scientific climate modelling.\n\nWhen activated as a role playing game, the character of the fortune teller can lay out the tarot deck and then point a smart phone at the centre cards to make holographic visualizations appear. They can then use those augmented reality images to recount and bring to life the story of five different Shared Socioeconomic Pathways (SSPs).\n\nThe Augmented Reality visualizations linked to the tarot cards were created using the Global Change Analysis Model (GCAM), developed by the Joint Global Change Research Institute, and a set of long-term scenarios, otherwise known as the Shared Socio-economic Pathways (SSP), to model possible socio-economic and environmental futures.\n\nThe graphs and values reported in this kit were developed by consulting with a computer model called GCAM: the Global Change Analysis Model.",
    workType: ["Augmented Reality"],
    year: 2020,
    platforms: [],
    links: ["https://www.fluxkitsef.ca/projects/earth-fortunes#h.bcaiytb3jbx9"],
    contacts: [],
    bios: [
      "Caitlin Fisher is an award-winning digital storyteller and poet, working mostly in XR. She directs the art+science Immersive Storytelling Lab and the Augmented Reality Lab at York University in Toronto. At York she is also Chair and a Full Professor in the Department of Film and Media Arts. A co-founder of York’s Future Cinema Lab and former Fulbright and Canada Research Chair, Caitlin has funded research projects in the areas of AI storytelling, co-creation between settler and indigenous artists in VR environments and is bringing the power of storytelling to the global health crisis of antimicrobial resistance through a new XR Museum project. She is immediate past President of the Electronic Literature Organization and is also a Prof. II at the University of Bergen, working with the Centre for Digital Narrative.",
    ],
    narrativeWords: ["foretell", "deal", "forecast", "diverge"],
    creaturePart: {
      id: "fortune-cards",
      label: "Tarot fins",
      description:
        "Card-thin fins fanned out like a spread, each one turned up on a different future of the planet.",
    },
  },
];

export const artifacts: ExhibitionArtifact[] = exhibitionSources.map(
  (artifact) => ({
    ...artifact,
    ...aquariumLayers[artifact.id],
  }),
);

export const artifactById = new Map(
  artifacts.map((artifact) => [artifact.id, artifact]),
);

export const artifactByTargetIndex = new Map(
  artifacts.map((artifact) => [artifact.targetIndex, artifact]),
);

/** One image compiled into public/targets/exhibition.mind, at MindAR anchor `anchorIndex`. */
export type TargetImage = {
  artifact: ExhibitionArtifact;
  surface: ConstellationSurface;
  anchorIndex: number;
};

/** The dark targets' background: the poster's abyss, so they sit seamlessly on it. */
export const darkTargetBackground = "#031015";

/** Artifacts that also have a target printed on the dark poster and tutorial sheet. */
const posterTargetIds = ["fishbowl-leaks"];

/**
 * Every compiled target in compile order: each artifact's white target at its own `targetIndex`,
 * then the poster's dark targets. A dark target opens the same artifact as its white one.
 */
export const targetImages: TargetImage[] = [
  ...artifacts.map((artifact) => ({ artifact, surface: "light" as const })),
  ...posterTargetIds.map((id) => ({ artifact: artifactById.get(id)!, surface: "dark" as const })),
].map((target, anchorIndex) => ({ ...target, anchorIndex }));

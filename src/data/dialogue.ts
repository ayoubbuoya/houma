// All speech bubble lines, grouped by situation. Tunisian Derja in Latin letters.
// TODO(owner): review all Derja lines

export const DIALOGUE = {
  greet: ['Aslema!', 'Ahla khouya', 'Labes?', 'Sbah el khir'],
  idle_chat: ['Chnowa el jdid?', 'El jaw behi lyoum', 'Barcha karhabet lyoum'],
  honked_at: ['Chbik?!', 'Saber chwaya!', 'Ya khouya rod belek!'],
  almost_hit: ['Rod belek ya mahboul!', 'Chbik tsouk haka?!'],
  crash_driver: ['Chbik?! Ma tchoufech?!', 'Haya, mchi!'],
  louage_pass: ['Win mechi?', 'Fama blasa?', 'Ya3tik essa7a'],
  police: ['Wa9ef!', 'Ebda 3la jnab!'],
};

export type DialogueKey = keyof typeof DIALOGUE;

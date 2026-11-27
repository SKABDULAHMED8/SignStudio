import { encryptPayload, decryptPayload } from '../security/crypto.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
export const MAX_PERSONAL_PROFILES = 5;
const FIELD_LIMITS = { fullName: 120, dateOfBirth: 20, mobile: 30, email: 160, address: 500, city: 100, state: 100, pinCode: 20 };

function normalizeProfile(input) {
  const name = String(input?.name ?? '').trim().slice(0, 60);
  if (!name) throw new TypeError('Enter a name for these details.');
  const fields = {};
  for (const [key, limit] of Object.entries(FIELD_LIMITS)) fields[key] = String(input?.fields?.[key] ?? '').trim().slice(0, limit);
  return { name, fields };
}

export class PersonalProfileStore {
  constructor(repository, keyProvider) { this.repository=repository; this.keyProvider=keyProvider; }

  async list() {
    const key=await this.keyProvider();
    const records=await this.repository.getAll('personal-profiles');
    return Promise.all(records.map(async record=>({id:record.id,...await this.#decrypt(key,record.encrypted),updatedAt:record.updatedAt})));
  }

  async get(id) {
    const record=await this.repository.get('personal-profiles',id);
    if(!record)return null;
    return {id:record.id,...await this.#decrypt(await this.keyProvider(),record.encrypted),updatedAt:record.updatedAt};
  }

  async save(input, id=null) {
    const profiles=await this.repository.getAll('personal-profiles');
    if(!id && profiles.length>=MAX_PERSONAL_PROFILES) throw new RangeError(`You can save up to ${MAX_PERSONAL_PROFILES} sets of details.`);
    if(id && !profiles.some(profile=>profile.id===id)) throw new Error('These saved details could not be found.');
    const normalized=normalizeProfile(input);
    const profileId=id ?? crypto.randomUUID();
    const key=await this.keyProvider();
    const encrypted=await encryptPayload(key,encoder.encode(JSON.stringify(normalized)));
    const record={id:profileId,encrypted,updatedAt:Date.now()};
    await this.repository.put('personal-profiles',record);
    return {id:profileId,name:normalized.name,updatedAt:record.updatedAt};
  }

  async delete(id) { await this.repository.delete('personal-profiles',id); }
  async clear() { await this.repository.clear('personal-profiles'); }

  async exportForRekey() {
    const records=await this.repository.getAll('personal-profiles');
    if(!records.length)return [];
    const key=await this.keyProvider();
    return Promise.all(records.map(async record=>({id:record.id,...await this.#decrypt(key,record.encrypted)})));
  }

  async importAfterRekey(profiles) {
    const key=await this.keyProvider();
    for(const profile of profiles) {
      const encrypted=await encryptPayload(key,encoder.encode(JSON.stringify(normalizeProfile(profile))));
      await this.repository.put('personal-profiles',{id:profile.id,encrypted,updatedAt:Date.now()});
    }
  }

  async #decrypt(key,encrypted) {
    const plain=await decryptPayload(key,encrypted);
    const value=JSON.parse(decoder.decode(plain));
    return normalizeProfile(value);
  }
}


const FIELD_ALIASES = {
  fullName: ['name','fullname','applicantname','customername','first name','surname'],
  dateOfBirth: ['dob','dateofbirth','birthdate'],
  mobile: ['mobile','mobilenumber','phone','phonenumber','contactnumber'],
  email: ['email','emailaddress'],
  address: ['address','correspondenceaddress','residentialaddress'],
  city: ['city','town'],
  state: ['state','province'],
  pinCode: ['pincode','postalcode','zipcode','postcode']
};

export function mapProfileFields(profile, acroFields) {
  const output = {};
  for (const field of acroFields ?? []) {
    if (!field?.supported || field.kind !== 'text') continue;
    const name = String(field.name ?? '').toLowerCase().replace(/[^a-z0-9]/g,'');
    const key = Object.keys(FIELD_ALIASES).find(candidate => FIELD_ALIASES[candidate].some(alias => { const normalized=alias.replace(/[^a-z0-9]/g,''); return name === normalized || (normalized.length > 4 && name.includes(normalized)); }));
    if (key && profile?.fields?.[key]) output[field.name] = profile.fields[key];
  }
  return output;
}

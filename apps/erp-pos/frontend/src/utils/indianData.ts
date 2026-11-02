export interface IndianState {
  name: string
  code: string
  gstCode: string
}

export const INDIAN_STATES: IndianState[] = [
  { name: 'Andhra Pradesh', code: 'AP', gstCode: '37' },
  { name: 'Arunachal Pradesh', code: 'AR', gstCode: '12' },
  { name: 'Assam', code: 'AS', gstCode: '18' },
  { name: 'Bihar', code: 'BR', gstCode: '10' },
  { name: 'Chhattisgarh', code: 'CG', gstCode: '22' },
  { name: 'Delhi', code: 'DL', gstCode: '07' },
  { name: 'Goa', code: 'GA', gstCode: '30' },
  { name: 'Gujarat', code: 'GJ', gstCode: '24' },
  { name: 'Haryana', code: 'HR', gstCode: '06' },
  { name: 'Himachal Pradesh', code: 'HP', gstCode: '02' },
  { name: 'Jharkhand', code: 'JH', gstCode: '20' },
  { name: 'Karnataka', code: 'KA', gstCode: '29' },
  { name: 'Kerala', code: 'KL', gstCode: '32' },
  { name: 'Madhya Pradesh', code: 'MP', gstCode: '23' },
  { name: 'Maharashtra', code: 'MH', gstCode: '27' },
  { name: 'Manipur', code: 'MN', gstCode: '14' },
  { name: 'Meghalaya', code: 'ML', gstCode: '17' },
  { name: 'Mizoram', code: 'MZ', gstCode: '15' },
  { name: 'Nagaland', code: 'NL', gstCode: '13' },
  { name: 'Odisha', code: 'OD', gstCode: '21' },
  { name: 'Punjab', code: 'PB', gstCode: '03' },
  { name: 'Rajasthan', code: 'RJ', gstCode: '08' },
  { name: 'Sikkim', code: 'SK', gstCode: '11' },
  { name: 'Tamil Nadu', code: 'TN', gstCode: '33' },
  { name: 'Telangana', code: 'TS', gstCode: '36' },
  { name: 'Tripura', code: 'TR', gstCode: '16' },
  { name: 'Uttar Pradesh', code: 'UP', gstCode: '09' },
  { name: 'Uttarakhand', code: 'UK', gstCode: '05' },
  { name: 'West Bengal', code: 'WB', gstCode: '19' },
  { name: 'Andaman & Nicobar Islands', code: 'AN', gstCode: '35' },
  { name: 'Chandigarh', code: 'CH', gstCode: '04' },
  { name: 'Dadra & Nagar Haveli and Daman & Diu', code: 'DD', gstCode: '26' },
  { name: 'Jammu & Kashmir', code: 'JK', gstCode: '01' },
  { name: 'Ladakh', code: 'LA', gstCode: '38' },
  { name: 'Lakshadweep', code: 'LD', gstCode: '31' },
  { name: 'Puducherry', code: 'PY', gstCode: '34' },
]

export const CITIES_BY_STATE: Record<string, string[]> = {
  'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Mancherial', 'Ramagundam', 'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Suryapet', 'Siddipet', 'Miryalaguda', 'Jagtial', 'Bhongir', 'Kamareddy', 'Mancherial', 'Kothagudem', 'Bodhan', 'Nirmal', 'Wanaparthy', 'Gadwal', 'Sangareddy', 'Medak', 'Jangaon'],
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Tirupati', 'Rajahmundry', 'Kadapa', 'Kakinada', 'Anantapur', 'Eluru', 'Ongole', 'Vizianagaram', 'Tenali', 'Proddatur', 'Chittoor', 'Hindupur', 'Bhimavaram', 'Machilipatnam', 'Srikakulam'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur', 'Amravati', 'Nanded', 'Sangli', 'Latur', 'Dhule', 'Akola', 'Jalgaon', 'Chandrapur', 'Parbhani', 'Ichalkaranji', 'Jalna', 'Ambarnath'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Hubli-Dharwad', 'Mangaluru', 'Belgaum', 'Gulbarga', 'Davanagere', 'Bellary', 'Bijapur', 'Shimoga', 'Tumkur', 'Raichur', 'Bidar', 'Hospet', 'Hassan', 'Gadag-Betageri', 'Udupi', 'Robertson Pet', 'Bhadravati', 'Chitradurga'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Tiruppur', 'Ranipet', 'Nagercoil', 'Thanjavur', 'Vellore', 'Kancheepuram', 'Erode', 'Tiruvannamalai', 'Pollachi', 'Rajapalayam', 'Sivakasi', 'Pudukkottai', 'Neyveli', 'Nagapattinam'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar', 'Gandhidham', 'Anand', 'Navsari', 'Morbi', 'Nadiad', 'Surendranagar', 'Bharuch', 'Mehsana', 'Bhuj', 'Porbandar', 'Palanpur', 'Valsad'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur', 'Bhilwara', 'Alwar', 'Bharatpur', 'Sikar', 'Pali', 'Sri Ganganagar', 'Tonk', 'Beawar', 'Hanumangarh', 'Bundi', 'Dhaulpur', 'Kishangarh', 'Banswara', 'Nagaur'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Ghaziabad', 'Noida', 'Bareilly', 'Aligarh', 'Moradabad', 'Gorakhpur', 'Saharanpur', 'Jhansi', 'Mathura', 'Firozabad', 'Muzaffarnagar', 'Shahjahanpur', 'Rampur', 'Ayodhya'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa', 'Murwara', 'Singrauli', 'Burhanpur', 'Khandwa', 'Bhind', 'Chhindwara', 'Guna', 'Shivpuri', 'Vidisha', 'Damoh'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman', 'Malda', 'Baharampur', 'Habra', 'Kharagpur', 'Shantipur', 'Dankuni', 'Dhulian', 'Ranaghat', 'Haldia', 'Raiganj', 'Krishnanagar', 'Nabadwip', 'Medinipur', 'Jalpaiguri'],
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga', 'Arrah', 'Begusarai', 'Katihar', 'Munger', 'Chapra', 'Sasaram', 'Hajipur', 'Dehri', 'Siwan', 'Motihari', 'Nawada', 'Bagaha', 'Buxar', 'Kishanganj'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Balasore', 'Baripada', 'Bhadrak', 'Jharsuguda'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Palakkad', 'Alappuzha', 'Kannur', 'Kottayam', 'Malappuram'],
  'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Pathankot', 'Hoshiarpur', 'Batala', 'Moga'],
  'Haryana': ['Faridabad', 'Gurgaon', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula'],
  'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon', 'Raigarh', 'Jagdalpur', 'Ambikapur', 'Dhamtari'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Hazaribagh', 'Giridih', 'Ramgarh', 'Medininagar', 'Chaibasa'],
  'Delhi': ['New Delhi', 'Delhi'],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
}

export function getStateByName(name: string): IndianState | undefined {
  return INDIAN_STATES.find(s => s.name === name)
}

export function getCitiesForState(stateName: string): string[] {
  return CITIES_BY_STATE[stateName] || []
}

export interface PincodeResult {
  city: string
  district: string
  state: string
  stateCode: string
}

export async function lookupPincode(pincode: string): Promise<PincodeResult | null> {
  if (!/^\d{6}$/.test(pincode)) return null
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`)
    const data = await res.json()
    if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
      const po = data[0].PostOffice[0]
      const state = INDIAN_STATES.find(s => s.name === po.State)
      return {
        city: po.District || po.Name,
        district: po.District,
        state: po.State,
        stateCode: state?.gstCode || '',
      }
    }
  } catch {}
  return null
}

export function validatePAN(pan: string): string | null {
  if (!pan) return null
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) return 'PAN format: ABCDE1234F (5 letters, 4 digits, 1 letter)'
  return null
}

export function validateGSTIN(gstin: string): string | null {
  if (!gstin) return null
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]{2}$/.test(gstin)) return 'GSTIN format: 36ABCDE1234F1Z5 (15 chars)'
  const stateCode = gstin.slice(0, 2)
  const validState = INDIAN_STATES.find(s => s.gstCode === stateCode)
  if (!validState) return `Invalid state code "${stateCode}" in GSTIN`
  return null
}

export function validatePhone(phone: string): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/[\s-]/g, '')
  if (/^\+91/.test(cleaned)) {
    if (!/^\+91\d{10}$/.test(cleaned)) return 'Phone: +91 followed by 10 digits'
  } else {
    if (!/^\d{10}$/.test(cleaned)) return 'Phone: 10 digits required'
  }
  return null
}

export function validateEmail(email: string): string | null {
  if (!email) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format'
  return null
}

export function validatePincode(pincode: string): string | null {
  if (!pincode) return null
  if (!/^\d{6}$/.test(pincode)) return 'Pincode: exactly 6 digits'
  return null
}

export function onlyNumbers(value: string): string {
  return value.replace(/\D/g, '')
}

export function onlyAlpha(value: string): string {
  return value.replace(/[^a-zA-Z\s.]/g, '')
}

export function onlyAlphaNumeric(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '')
}

/** Product name, owner and contact details, used by the header, footer, manifest and reports. */
export const APP_NAME = "TmtechSolar Pro";
export const APP_SHORT_NAME = "TmtechSolar"; // home-screen label: keep to 12 characters

export const COMPANY = {
  name: "Triple Multipurpose Technology",
  website: "https://triplemultipurposetechnology.com.ng",
  websiteLabel: "triplemultipurposetechnology.com.ng",
  ceo: "Engr. Musab Mubaraq Mburaimoh",
  emails: ["musab.buraimoh@gmail.com", "support@triplemultipurposetechnology.com.ng"],
  phones: [
    { tel: "+2348162552901", label: "+234 816 255 2901" },
    { tel: "+2349049376773", label: "+234 904 937 6773" },
  ],
} as const;

/** Third-party data the app uses, with the attribution each provider asks for. */
export const DATA_CREDITS = [
  {
    name: "NASA POWER",
    url: "https://power.larc.nasa.gov/",
    use: "Monthly solar irradiance, temperature and record temperature data, fetched automatically for each site.",
    attribution:
      "These data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program.",
  },
  {
    name: "Global Solar Atlas 2.0",
    url: "https://globalsolaratlas.info/",
    use: "Irradiance, PV output and optimum tilt values that engineers look up and enter themselves (the app does not access the site automatically).",
    attribution:
      "Global Solar Atlas 2.0, a free, web-based application, is developed and operated by the company Solargis s.r.o. on behalf of the World Bank Group, utilizing Solargis data, with funding provided by the Energy Sector Management Assistance Program (ESMAP). Data licensed under CC BY 4.0.",
  },
  {
    name: "CEC PV module list via NREL System Advisor Model (SAM)",
    url: "https://github.com/NREL/SAM",
    use: "Electrical and temperature data for 21,677 certified PV modules in the module search.",
    attribution:
      "Module data from the California Energy Commission (CEC) list of eligible PV modules, as distributed in the NREL System Advisor Model libraries. Copyright © Alliance for Sustainable Energy, LLC. Used under the BSD 3-Clause License (full text below).",
  },
  {
    name: "Manufacturer datasheets",
    url: "",
    use: "Specifications of the verified inverters, batteries, charge controllers and modules in the built-in library.",
    attribution:
      "Values transcribed from each manufacturer's published datasheet, linked on every item. Product names and trademarks belong to their respective owners; their use here does not imply endorsement.",
  },
] as const;

/** Open-source software the app is built with. */
export const SOFTWARE_CREDITS = [
  { name: "Next.js", license: "MIT", url: "https://nextjs.org/" },
  { name: "React", license: "MIT", url: "https://react.dev/" },
  { name: "Tailwind CSS", license: "MIT", url: "https://tailwindcss.com/" },
  { name: "Mongoose", license: "MIT", url: "https://mongoosejs.com/" },
  { name: "MongoDB Node.js driver", license: "Apache-2.0", url: "https://github.com/mongodb/node-mongodb-native" },
  { name: "Zod", license: "MIT", url: "https://zod.dev/" },
  { name: "jose", license: "MIT", url: "https://github.com/panva/jose" },
  { name: "bcrypt.js", license: "BSD-3-Clause", url: "https://github.com/dcodeIO/bcrypt.js" },
] as const;

export const BSD_3_CLAUSE = `Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;

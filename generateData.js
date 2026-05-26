const fs = require("fs");

/* ---------------- CONFIG ---------------- */

const zones = ["North", "South", "East", "West"];

const fruits = [
"Apple","Mango","Orange","Banana","Grape",
"Papaya","Guava","Pineapple","Peach"
];

const flowers = [
"Rose","Lily","Lotus","Jasmine","Tulip",
"Daisy","Orchid","Sunflower","Marigold","Lavender",
"Hibiscus","Magnolia","Peony","Camellia","Iris",
"Azalea","Begonia","Bluebell","Buttercup","Carnation",
"Chrysanthemum","Daffodil","Gardenia","Geranium","Hydrangea",
"Poppy","Primrose","Snowdrop","Verbena","Zinnia"
];

const areaNames = [
"MG Road","Indiranagar","Whitefield","Yelahanka","Hebbal",
"BTM","Jayanagar","Rajajinagar","KR Puram","Malleshwaram",
"Electronic City","Banashankari","Kengeri","Peenya","Ulsoor",
"Marathahalli","Domlur","Hosur Road","Bellandur","Sarjapur"
];

const firstNames = ["Ravi","Suresh","Anita","Kiran","Meena","Arjun","Vijay","Deepa","Rahul","Sneha"];
const lastNames = ["Kumar","Rao","Sharma","Reddy","Nair","Iyer","Patel","Das","Gupta","Singh"];

/* ------------- HELPERS ---------------- */

const rand = arr => arr[Math.floor(Math.random()*arr.length)];

function randomName(){
    return `${rand(firstNames)} ${rand(lastNames)}`;
}

function phone(){
    return "9" + Math.floor(100000000 + Math.random()*900000000);
}

function email(name, level){
    return name.toLowerCase().replace(" ",".") +
        `@utility-${level}.com`;
}

function address(area, zone){
    return `${area}, ${zone} Region Office`;
}

function coords(){
    return {
        lat: (12 + Math.random()).toFixed(6),
        lng: (77 + Math.random()).toFixed(6)
    };
}

/* ------------ GENERATION ------------- */

let records = [];

let circleIndex = 0;
let divisionIndex = 0;
let subdivisionIndex = 1;
let sectionIndex = 1;

const subdivisionCounters = {
    North: 1,
    South: 1,
    East: 1,
    West: 1
};

const zonePrefix = {
    North: "N",
    South: "S",
    East: "E",
    West: "W"
};

/* ZONES */
zones.forEach(zone => {

    const zoneHead = randomName();

    records.push({
        level:"Zone",
        zone,
        officeName:`Office of Chief Engineer - ${zone} Zone`,
        officer:{
            name:zoneHead,
            designation:"Chief Engineer",
            email:email(zoneHead,"zone"),
            mobile:phone()
        },
        address:address("Head Office",zone),
        gis:coords()
    });

    /* assign circles */
    const circlesPerZone =
        zone === "North" ? 3 :
        zone === "South" ? 2 :
        zone === "East" ? 2 : 2;

    for(let c=0;c<circlesPerZone;c++){

        const circleName = fruits[circleIndex++];
        const circleHead = randomName();

        records.push({
            level:"Circle",
            zone,
            circle:circleName,
            officeName:`${circleName} Circle Office`,
            officer:{
                name:circleHead,
                designation:"Superintending Engineer",
                email:email(circleHead,"circle"),
                mobile:phone()
            },
            address:address(circleName,zone),
            gis:coords()
        });

        /* divisions per circle */
        const divisionsPerCircle = 3 + Math.floor(Math.random()*2);

        for(let d=0; d<divisionsPerCircle && divisionIndex<30; d++){

            const divisionName = flowers[divisionIndex++];
            const divisionHead = randomName();

            records.push({
                level:"Division",
                zone,
                circle:circleName,
                division:divisionName,
                officeName:`${divisionName} Division Office`,
                officer:{
                    name:divisionHead,
                    designation:"Executive Engineer",
                    email:email(divisionHead,"division"),
                    mobile:phone()
                },
                address:address(divisionName,zone),
                gis:coords()
            });

            /* subdivisions */
            for(let s=0; s<4 && subdivisionIndex<=120; s++){

                const subCode = `${zonePrefix[zone]}${subdivisionCounters[zone]++}`;
                const subHead = randomName();

                records.push({
                    level:"Subdivision",
                    zone,
                    circle:circleName,
                    division:divisionName,
                    subdivision:subCode,
                    officeName:`Subdivision ${subCode}`,
                    officer:{
                        name:subHead,
                        designation:"Assistant Executive Engineer",
                        email:email(subHead,"subdivision"),
                        mobile:phone()
                    },
                    address:address(subCode,zone),
                    gis:coords()
                });

                /* sections */
                for(let sec=0; sec<2 && sectionIndex<=200; sec++){

                    const area = rand(areaNames);
                    const secHead = randomName();

                    records.push({
                        level:"Section",
                        zone,
                        circle:circleName,
                        division:divisionName,
                        subdivision:subCode,
                        section:`SEC-${sectionIndex++}`,
                        officeName:`Office of the Assistant Engineer of ${area} Section`,
                        officer:{
                            name:secHead,
                            designation:"Assistant Engineer",
                            email:email(secHead,"section"),
                            mobile:phone()
                        },
                        address:address(area,zone),
                        gis:coords()
                    });
                }
            }
        }
    }
});

/* -------- SAVE FILE -------- */

fs.writeFileSync("data.json", JSON.stringify(records,null,2));

console.log("✅ data.json generated successfully");
console.log(`Total records: ${records.length}`);
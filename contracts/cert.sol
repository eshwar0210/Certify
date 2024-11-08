// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

contract Cert {
    address public admin;

    constructor() {
        admin = msg.sender;
    }

    struct Institute {
        string name;
        string acr;
        string link;
        string[] course;
        bool del;
    }

    mapping(address => Institute) public institutes;
    address[] public InstAddressList;
    uint public instcnt;

    function addInstitute(
        address instad,
        string memory _name,
        string memory _acr,
        string memory _link,
        string[] memory _course
    ) public {
        require(msg.sender == admin, "Only admin can add institutes");

        institutes[instad] = Institute(_name, _acr, _link, _course, false);
        InstAddressList.push(instad);
        instcnt++;
    }

    function viewInstitute(address instad) public view returns (Institute memory) {
        require(msg.sender == admin, "Only admin can view institute details");

        if (institutes[instad].del) {
            string[] memory emptyCourses;
            return Institute("invalid", "inv", "null", emptyCourses, false);
        }
        
        return institutes[instad];
    }

    function getInstituteName(address instad) public view returns (string memory) {
        return institutes[instad].name;   
    }   


    function updateInstitute(
        address instad,
        string memory _name,
        string memory _acr,
        string memory _link,
        string[] memory _course
    ) public {
        require(institutes[instad].del == false, "Institute has been deleted");

        institutes[instad].name = _name;
        institutes[instad].acr = _acr;
        institutes[instad].link = _link;

        // Reset the course array
        delete institutes[instad].course;
        for (uint i = 0; i < _course.length; i++) {
            institutes[instad].course.push(_course[i]);
        }
    }

    function deleteInstitute(address instad) public {
        require(msg.sender == admin, "Only admin can delete institutes");

        institutes[instad].del = true;
        instcnt--;
    }

    function viewAllInstitutes() public view returns (Institute[] memory) {
        Institute[] memory ans = new Institute[](instcnt);
        uint j = 0;

        for (uint i = 0; i < InstAddressList.length; i++) {
            if (!institutes[InstAddressList[i]].del) {
                ans[j] = institutes[InstAddressList[i]];
                j++;
            }
        }
        return ans;
    }

    mapping(address => string) public students;
    address[] public StudAddressList;
    uint public studcnt;

    function addStudent(address studad, string memory _name) public {
        students[studad] = _name;
        StudAddressList.push(studad);
        studcnt++;
    }

    function getStudentName(address studentAddress) public view returns (string memory) {
        return students[studentAddress];   
    }

    // Updated Certificate struct with certad (certificate address)
    struct Certificate {
        address certad;  // Address of the certificate
        address stud;
        address inst;
        string course;
        int duration;
        bool del;
    }

    mapping(address => Certificate) public certificates;
    address[] public certAddressList;

    function issueCertificate(
        address certad,
        address instad,
        address studad,
        string memory _course,
        int dur
    ) public {
        require(!institutes[instad].del, "Institute is deleted");
        require(!institutes[msg.sender].del, "Only active institutes can issue certificates");

        certificates[certad] = Certificate(certad, studad, instad, _course, dur, false);
        certAddressList.push(certad);
    }

    function revokeCertificate(address certad) public {
        require(!institutes[msg.sender].del, "Only active institutes can revoke certificates");

        certificates[certad].del = true;
    }

    function viewCertificate(address certad) public view returns (Certificate memory) {
        return certificates[certad];
    }

    function viewStudCert(address studad) public view returns (Certificate[] memory) {
        uint cnt = 0;
        
        // Count the number of valid certificates
        for (uint i = 0; i < certAddressList.length; i++) {
            if (!certificates[certAddressList[i]].del && certificates[certAddressList[i]].stud == studad) {
                if (!institutes[certificates[certAddressList[i]].inst].del) {
                    cnt++;
                }
            }
        }

        // Collect valid certificates
        Certificate[] memory ans = new Certificate[](cnt);
        uint j = 0;
        
        for (uint i = 0; i < certAddressList.length; i++) {
            if (!certificates[certAddressList[i]].del && certificates[certAddressList[i]].stud == studad) {
                if (!institutes[certificates[certAddressList[i]].inst].del) {
                    ans[j] = certificates[certAddressList[i]];
                    j++;
                }
            }
        }
        return ans;
    }
}

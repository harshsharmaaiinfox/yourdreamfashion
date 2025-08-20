import { ChangeDetectorRef, Component, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ModalDismissReasons, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Select, Store } from '@ngxs/store';
import { debounceTime, distinctUntilChanged, map, Observable } from 'rxjs';
import { Select2Data, Select2UpdateEvent } from 'ng-select2-component';
import { CreateAddress, UpdateAddress } from '../../../../action/account.action';
import { CountryState } from '../../../../state/country.state';
import { StateState } from '../../../../state/state.state';
import { UserAddress } from '../../../../interface/user.interface';
import * as data from '../../../../data/country-code';
import { Country, State, City }  from 'country-state-city';
import { AuthService } from '../../../../services/auth.service';
import { NotificationService } from '../../../../services/notification.service';
import { get } from 'http';
import { state } from '@angular/animations';

@Component({
  selector: 'address-modal',
  templateUrl: './address-modal.component.html',
  styleUrls: ['./address-modal.component.scss']
})
export class AddressModalComponent {

  public form: FormGroup;
  public closeResult: string;
  public modalOpen: boolean = false;

  public states$: Observable<Select2Data>;
  public city$: Observable<Select2Data>;
  public cityOptions: Select2Data = [];
  public address: UserAddress | null;
  public codes = data.countryCodes;

  public pinCodeAreaOfficeCircleDataJSON: any;
  public stateNameData: any;
  public regionNameData: any;
  public circleNameData: any;
  public officeNameData: any; // Area Name
  public divisionNameData: any;
  public cityNameData: any; // District Name

  @ViewChild("addressModal", { static: false }) AddressModal: TemplateRef<string>;
  @Select(CountryState.countries) countries$: Observable<Select2Data>;
  
  public selectedPinCode = '';
  public filterPinCodeAreas: any;
  public checkIfPinCodeExists = true;

  // Custom validator for title field - only letters and spaces allowed
  private titleValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }
    const titlePattern = /^[a-zA-Z]+(\s[a-zA-Z]+)*$/;
    const trimmedValue = control.value.trim();
    
    if (trimmedValue.length < 2) {
      return { invalidTitle: true };
    }
    
    return titlePattern.test(control.value) ? null : { invalidTitle: true };
  }

  // Method to prevent special characters and numbers on input
  public onTitleInput(event: any): void {
    const input = event.target;
    const value = input.value;
    // Remove special characters and numbers, keep only letters and spaces
    const filteredValue = value.replace(/[^a-zA-Z\s]/g, '');
    // Remove extra spaces and ensure proper formatting
    const formattedValue = filteredValue.replace(/\s+/g, ' ').trim();
    
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.form.get('title')?.setValue(filteredValue, { emitEvent: false });
    }
  }

  // Method to prevent typing special characters and numbers in real-time
  public onTitleKeypress(event: KeyboardEvent): boolean {
    const char = String.fromCharCode(event.which);
    const pattern = /[a-zA-Z\s]/;
    
    if (!pattern.test(char)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  // Method to prevent pasting invalid content in title field
  public onTitlePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text/plain') || '';
    const filteredText = pastedText.replace(/[^a-zA-Z\s]/g, '');
    const formattedText = filteredText.replace(/\s+/g, ' ').trim();
    
    if (formattedText) {
      const input = event.target as HTMLInputElement;
      input.value = formattedText;
      this.form.get('title')?.setValue(formattedText, { emitEvent: false });
    }
  }

  // Method to prevent non-numeric input in phone field
  public onPhoneInput(event: any): void {
    const input = event.target;
    const value = input.value;
    // Remove any non-numeric characters
    const numericValue = value.replace(/[^0-9]/g, '');
    
    if (value !== numericValue) {
      input.value = numericValue;
      this.form.get('phone')?.setValue(numericValue, { emitEvent: false });
    }
    
    // Limit to 10 digits
    if (numericValue.length > 10) {
      const truncatedValue = numericValue.slice(0, 10);
      input.value = truncatedValue;
      this.form.get('phone')?.setValue(truncatedValue, { emitEvent: false });
    }
  }

  // Method to prevent typing alphabets in real-time for phone fields
  public onPhoneKeypress(event: KeyboardEvent): boolean {
    const char = String.fromCharCode(event.which);
    const pattern = /[0-9]/;
    
    if (!pattern.test(char)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  // Method to prevent pasting invalid content in phone field
  public onPhonePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text/plain') || '';
    const numericText = pastedText.replace(/[^0-9]/g, '');
    const truncatedText = numericText.slice(0, 10);
    
    if (truncatedText) {
      const input = event.target as HTMLInputElement;
      input.value = truncatedText;
      this.form.get('phone')?.setValue(truncatedText, { emitEvent: false });
    }
  }

  constructor(
    private modalService: NgbModal,
    private store: Store,
    private formBuilder: FormBuilder,
    private cdRef: ChangeDetectorRef,
    private authService: AuthService,
    private notificationService: NotificationService

  ) {
    this.form = this.formBuilder.group({
      title: new FormControl('', [Validators.required, this.titleValidator.bind(this)]),
      street: new FormControl('', [Validators.required]),
      state_id: new FormControl('', [Validators.required]),
      country_id: new FormControl('', [Validators.required]),
      city: new FormControl('', [Validators.required]),
      area: new FormControl('', [Validators.required]),
      pincode: new FormControl('', [Validators.required]),
      country_code: new FormControl('91', [Validators.required]),
      phone: new FormControl('', [Validators.required, Validators.pattern(/^[0-9]{10}$/)])
    })

    this.form.controls['phone']?.valueChanges.subscribe((value) => {
      if (value && value.toString().length !== 10) {
        this.form.controls['phone'].markAsTouched();
        this.form.controls['phone'].setErrors({invalid: true});
      } else if (value && value.toString().length === 10) {
        this.form.controls['phone'].setErrors(null);
      }
    });

    const localUserCheck = JSON.parse(localStorage.getItem('account') || '');
    if(localUserCheck?.user?.access_token) {
      
    }
    this.downloadPINAreaExcelJSON();

    this.form.controls['pincode']?.valueChanges
    .pipe(
      debounceTime(500),
      distinctUntilChanged()
    )
    .subscribe((value) => {
      if(value && value.toString().length > 5) {
        const checkIfPinCodeExists = this.officeNameData.filter((dataz: any) => dataz.OfficeName == this.form.controls['area'].value);
        if(!checkIfPinCodeExists.length || checkIfPinCodeExists[0].Pincode !== value) {
          this.checkIfPinCodeExists = false;
          this.filterPinCodeAreas = [];
          this.filterPinCodeAreas = this.pinCodeAreaOfficeCircleDataJSON.filter((dataz: any) => dataz.Pincode == value);
          if(this.filterPinCodeAreas.length) {
            this.cityOptions = [];
            this.officeNameData = [];
            
            const filteredDistricts = this.pinCodeAreaOfficeCircleDataJSON
            .filter((item: any) => item.StateName === this.filterPinCodeAreas[0].StateName)
            .map((item: any) => ({
              District: item.District,
              RegionName: item.RegionName,
              CircleName: item.CircleName,
              DivisionName: item.DivisionName,
              OfficeName: item.OfficeName,
            }))
            .filter((value: any, index: number, self: any) => 
              self.findIndex((v: any) => v.District === value.District) === index
            );

            this.cityOptions = filteredDistricts.map((district: any) => ({
              ...district,
              label: district.District,
              value: district.District,
            }));
            
            // Area Data

            const getPINAreaOfficeCircleData = this.pinCodeAreaOfficeCircleDataJSON.filter((dataz: any) => {
              return dataz.District?.toLowerCase() == this.filterPinCodeAreas[0].District.toLowerCase()
            });
            if(getPINAreaOfficeCircleData.length) {
              getPINAreaOfficeCircleData.forEach((dataz: any) => {
                this.officeNameData.push({
                  ...dataz,
                  label: dataz.OfficeName,
                  value: dataz.OfficeName
                });
              });
            } else {
              this.officeNameData.push({
                label: 'Other',
                value: 'Other',
                pinCode: ''
              });
            }

            this.form.controls['state_id'].setValue(this.filterPinCodeAreas.length ? this.filterPinCodeAreas[0].label : '');
            setTimeout(() => {
              this.form.controls['city'].setValue(this.filterPinCodeAreas.length ? this.filterPinCodeAreas[0].District : '');
              this.form.controls['area'].setValue(this.officeNameData.length ? this.officeNameData[0].label : '');
              this.checkIfPinCodeExists = true;
            }, 500);
          } else {
            this.checkIfPinCodeExists = true;
            this.form.controls['pincode'].markAsTouched();
            this.form.controls['pincode'].setErrors({required: true});
            this.notificationService.showError('Invalid Pincode');
          }
        } else {
          this.checkIfPinCodeExists = true;
          this.selectedPinCode = value;
        }
      }
    });

    setTimeout(() => {
      this.form.controls['country_id'].disable();
      this.form.controls['area'].disable();
      this.form.controls['pincode'].disable();
      this.form.controls['country_code'].disable();
    }, 500);

  }

  capitalizeFirstLetter(val: string) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
  }

  downloadPINAreaExcelJSON() {
    this.authService.fetchAreaPINCodeJSON().subscribe({
      next: (res) => {
        if(res) {
          this.pinCodeAreaOfficeCircleDataJSON = res['data'];
          this.stateNameData = [...new Map(this.pinCodeAreaOfficeCircleDataJSON.map((item: any) => [item.StateName, item])).values()];
        } else {
          this.notificationService.showError('Failed to fetch Pincode and Area data');
        }
      }
    });
  }

  validatePinCode(payload: any) {
    this.authService.validatePinCode(payload).subscribe({
      next: (res) => {
        if(res.status) {
          this.form.controls['pincode'].setErrors(null);
        } else {
          this.form.controls['pincode'].markAsTouched();
          this.form.controls['pincode'].setErrors({required: true});
          this.notificationService.showError(res.msg);
        }
      }
    });
  }

  countryChange(data: Select2UpdateEvent) {
    if(data && data?.value) {
      // this.states$ = this.store
      //     .select(StateState.states)
      //     .pipe(map(filterFn => filterFn(+data?.value)));
      // if(!this.address)
      //   this.form.controls['state_id'].setValue('');
    } else {
      this.form.controls['state_id'].setValue('');
    }
  }

  stateChange(data: Select2UpdateEvent) {
    if(data && data?.value && this.checkIfPinCodeExists) {
      this.form.controls['city'].setValue('');
      this.form.controls['area'].setValue('');
      this.form.controls['pincode'].setValue('');
      const selectedState = data.options[0].label;
      const filteredDistricts = this.pinCodeAreaOfficeCircleDataJSON
        .filter((item: any) => item.StateName === selectedState)
        .map((item: any) => ({
          District: item.District,
          RegionName: item.RegionName,
          CircleName: item.CircleName,
          DivisionName: item.DivisionName,
          OfficeName: item.OfficeName,
        }))
        .filter((value: any, index: number, self: any) => 
          self.findIndex((v: any) => v.District === value.District) === index
        );

      this.cityOptions = filteredDistricts.map((district: any) => ({
        ...district,
        label: district.District,
        value: district.District,
      }));

    } else {
      // this.form.controls['city'].setValue('');
    }
  }
  
  cityChange(data: Select2UpdateEvent) {
    if(data && data?.value && this.checkIfPinCodeExists) {
      this.form.controls['area'].setValue('');
      this.form.controls['pincode'].setValue('');
      this.officeNameData = [];
      const getPINAreaOfficeCircleData = this.pinCodeAreaOfficeCircleDataJSON.filter((dataz: any) => {
        return dataz.District?.toLowerCase() == data.value?.toString().toLowerCase()
      });
      if(getPINAreaOfficeCircleData.length) {
        getPINAreaOfficeCircleData.forEach((dataz: any) => {
          this.officeNameData.push({
            ...dataz,
            label: dataz.OfficeName,
            value: dataz.OfficeName
          });
        });
      } else {
        this.officeNameData.push({
          label: 'Other',
          value: 'Other',
          pinCode: ''
        });
      }
      this.form.controls['area'].enable();
    }
  }

  areaChange(data: Select2UpdateEvent) {
    if(data && data?.value && this.checkIfPinCodeExists) {
      this.form.controls['pincode'].enable();
      const filterPinCode = this.officeNameData.filter((dataz: any) => dataz.label == data.value);
      this.form.controls['pincode'].setValue(filterPinCode.length ? filterPinCode[0].Pincode : '');
    }
  }

  async openModal(value?: UserAddress) {
    this.modalOpen = true;
    this.patchForm(value);
    this.modalService.open(this.AddressModal, {
      ariaLabelledBy: 'address-add-Modal',
      centered: true,
      windowClass: 'theme-modal modal-lg address-modal'
    }).result.then((result) => {
      `Result ${result}`
    }, (reason) => {
      this.closeResult = `Dismissed ${this.getDismissReason(reason)}`;
    });
  }


  private getDismissReason(reason: ModalDismissReasons): string {
    if (reason === ModalDismissReasons.ESC) {
      return 'by pressing ESC';
    } else if (reason === ModalDismissReasons.BACKDROP_CLICK) {
      return 'by clicking on a backdrop';
    } else {
      return `with: ${reason}`;
    }
  }

  patchForm(value?: UserAddress) {
    if(value) {
      this.address = value;
      this.form.patchValue({
        user_id: value?.user_id,
        title: value?.title,
        street: value?.street,
        country_id: value?.country_id,
        state_id: value?.state_id,
        city: value?.city,
        pincode: value?.pincode,
        area: value?.area,
        country_code: value?.country_code,
        phone: value?.phone
      });
      setTimeout(() => this.form.controls['country_code'].setValue('91'), 300);
      setTimeout(() => this.form.controls['state_id'].setValue(value?.state_id), 400);
      setTimeout(() => this.form.controls['city'].setValue(value?.city), 600);
      setTimeout(() => this.form.controls['area'].setValue(value?.area), 800);
    } else {
      this.address = null;
      this.form.reset();
      this.form?.controls?.['country_code'].setValue('91');
    }
  }

  submit(){

    this.form.markAllAsTouched();
    this.form.value['country_id'] = 'INDIA';
    let action = new CreateAddress(this.form.value);

    if(this.address) {
      action = new UpdateAddress(this.form.value, this.address.id);
    }
    if(this.form.valid) {
      this.store.dispatch(action).subscribe({
        complete: () => {
          this.form.reset();
          if(!this.address){
            this.form?.controls?.['country_code'].setValue('91');
          }
        }
      });
    }
  }

  ngOnDestroy() {
    if(this.modalOpen) {
      this.modalService.dismissAll();
    }
  }

}
